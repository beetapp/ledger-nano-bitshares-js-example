import BTS from './BTS.js';
import {
    Apis
} from "bitsharesjs-ws";

let bts = new BTS();

let fromAccount = '1.2.711128' // clockwork
let toAccount = '1.2.1152309' //beet
let amount = 100000 // 1 BTS
async function testLedger() {
    try {
        await bts.connect();
    } catch (e) {
        throw new Error('Could not connect to Ledger Nano. Check if connected.');
    }
    try {
        let key = await bts.getPublicKey("48'/1'/1'/0'/0'");
        console.log(key);
    } catch (e) {
        throw new Error('Could not retrieve public key.');
    }
    let tx;
    try {

        tx = await bts.prepareAndSignOp("48'/1'/1'/0'/0'", "transfer", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            from: fromAccount,
            to: toAccount,
            amount: {
                amount: amount,
                asset_id: "1.3.0"
            }
        });
    } catch (e) {
        throw new Error(e);
    }


    Apis.instance()
        .network_api()
        .exec("broadcast_transaction_with_callback", [
            function (res) {
                console.log(res);
            },
            tx
        ])
        .catch((e) => {
            throw new Error(e);
        });
}
try {
    testLedger();
} catch (e) {
    console.log(e);
}