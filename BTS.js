import Transport from "@ledgerhq/hw-transport-node-hid";
import struct from "python-struct";
import {
    TransactionBuilder
} from "bitsharesjs";
import {
    Apis
} from "bitsharesjs-ws";
import varint from 'varint';
import {
    ops
} from "bitsharesjs/dist/serializer";
let instance = null;

class BTS {

    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
    parse_bip32_path(path) {

        if (path.length == 0) {
            return Buffer.alloc(0);
        }
        var result = Buffer.alloc(0);
        let elements = path.split("/");
        for (let pathElementIndex in elements) {
            let pathElement = elements[pathElementIndex];
            let element = pathElement.split("'");
            if (element.length == 1) {
                result = Buffer.concat([result, struct.pack(">I", Number(element[0]))]);
            } else {
                result = Buffer.concat([result, struct.pack(">I", (parseInt("80000000", 16) | Number(element[0])) >>> 0)]);
            }
        }
        return result;
    }
    async connect() {
        try {
            this.transport = await Transport.create();
            return this;
        } catch (e) {
            throw new Error('Could not connect to Ledger Nano S');
        }
    }
    async getPublicKey(path) {
        let donglePath = this.parse_bip32_path(path);
        let apdu = Buffer.concat([
            Buffer.from(
                "B5020001" +
                (donglePath.length + 1).toString(16).padStart(2, '0') +
                (Math.floor(donglePath.length / 4).toString(16).padStart(2, '0')), "hex"),
            donglePath
        ]);
        try {
            let response = await this.transport.exchange(apdu);
            let offset = 1 + response[0];
            let address = response.slice(offset + 1, offset + 1 + response[offset]);
            return address.toString('utf8')
        } catch (e) {
            throw new Error('Could not retrieve key from Ledger Nano S');
        }
    }
    async prepareAndSignOp(path, op_type, op_data) { // Method signature is same as bitsharesjs Transaction Builder

        let donglePath = this.parse_bip32_path(path);
        let node = await Apis.instance("wss://bts-seoul.clockwork.gr", true).init_promise;
        let chain_id = node[0].network.chain_id;
        let tr = new TransactionBuilder();
        tr.add_type_operation(op_type, op_data);
        await tr.set_required_fees();
        await tr.finalize();

        var output = Buffer.from('0420' + chain_id, 'hex');
        var ref_block_num = Buffer.allocUnsafe(2);
        ref_block_num.writeUInt16LE(Number(tr.ref_block_num));
        var ref_block_prefix = Buffer.allocUnsafe(4);
        ref_block_prefix.writeUInt32LE(Number(tr.ref_block_prefix));
        var expiration = Buffer.allocUnsafe(4);
        expiration.writeUInt32LE(Number(tr.expiration));
        var oplen = Buffer.from(varint.encode(1));
        var opId = Buffer.from(varint.encode(Number(tr.operations[0][0])));
        var op = ops[op_type].toBuffer(tr.operations[0][1]);
        output = Buffer.concat([
            output, Buffer.from('04', 'hex'),
            Buffer.from(varint.encode(ref_block_num.length)),
            ref_block_num,
            Buffer.from('04', 'hex'),
            Buffer.from(varint.encode(ref_block_prefix.length)),
            ref_block_prefix, Buffer.from('04', 'hex'),
            Buffer.from(varint.encode(expiration.length)),
            expiration, Buffer.from('04', 'hex'),
            Buffer.from(varint.encode(oplen.length)),
            oplen, Buffer.from('04', 'hex'),
            Buffer.from(varint.encode(opId.length)),
            opId, Buffer.from('04', 'hex'),
            Buffer.from(varint.encode(op.length)),
            op,
            Buffer.from('040100', 'hex')
        ]);


        let offset = 0;
        let first = true;
        let signSize = output.length;
        let chunk;
        let totalSize;
        let apdu3;
        let response;

        while (offset != signSize) {
            if (signSize - offset > 200) {
                chunk = output.slice(offset, offset + 200);
            } else {
                chunk = output.slice(offset);
            }

            if (first) {
                totalSize = donglePath.length + 1 + chunk.length;
                apdu3 = Buffer.concat([
                    Buffer.from("B5040000" +
                        totalSize.toString(16).padStart(2, '0') +
                        (Math.floor(donglePath.length / 4).toString(16).padStart(2, '0')), "hex"
                    ),
                    donglePath,
                    chunk
                ]);
                first = false;
            } else {
                totalSize = chunk.length;
                apdu3 = Buffer.concat([
                    Buffer.from("B5048000" +
                        totalSize.toString(16).padStart(2, '0'), "hex"),
                    chunk
                ]);
            }
            offset = offset + chunk.length;
            response = await this.transport.exchange(apdu3);
            if (response.slice(-2).toString('hex') != '9000') {
                throw new Error('User rejected the tx.');
            }
        }
        let signature = response.slice(0, 65).toString('hex');
        let tx = tr.toObject();
        tx.signatures.push(signature);
        return tx;
    }
}
export default BTS;