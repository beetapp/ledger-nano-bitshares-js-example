# ledger-nano-bitshares-js-example

`git clone https://github.com/clockworkgr/ledger-nano-bitshares-js-example`

`cd ledger-nano-bitshares-js-example`

`npm install`

`npm run start`

Will print out a public key for path 48'/1'/1'/0'/0'.

Then try to perform a transfer op.

Broadcasting it will fail until the key returned above is added to the active authority of the sending account.

Modify fromAccount,toAccount,amount to test.