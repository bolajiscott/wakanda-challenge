const algosdk = require("algosdk");
const { config } = require("dotenv");
config();

const fundingWalletKey = algosdk.mnemonicToSecretKey(
  process.env.FUNDING_WALLET_MNEMONIC
);
// const privateKeyBytes = new Uint8Array(Buffer.from(fundingWalletKey, "base64"));
const fundingWalletAddresss = process.env.FUNDING_WALLET_ADDRESS;
// const passphrase = algosdk.secretKeyToMnemonic(A.sk);
// console.log(`My address: ${A.addr}`);
// console.log(`My passphrase: ${passphrase}`);

const algodToken = "a".repeat(64);
const algodServer = "http://localhost";
const algodPort = 4001;
const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

async function fundWallet(to, amount) {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fundingWalletAddresss,
    suggestedParams,
    receiver: to,
    amount: amount * 10 ** 6,
    note: new Uint8Array(Buffer.from("Fund wallet")),
  });

  const signedTransaction = algosdk.signTransaction(txn, fundingWalletKey.sk);
  const { txid } = await algodClient
    .sendRawTransaction(signedTransaction.blob)
    .do();
  await algosdk.waitForConfirmation(algodClient, txid, 3);
  return txid;
}

async function createAsset(
  creator,
  name,
  symbol,
  totalSupply,
  decimal,
  frozen = false
) {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creator.addr,
    suggestedParams,
    defaultFrozen: frozen,
    unitName: symbol,
    assetName: name,
    manager: creator.addr,
    reserve: creator.addr,
    freeze: creator.addr,
    clawback: creator.addr,
    total: totalSupply,
    decimals: decimal,
  });
  const signedTransaction = txn.signTxn(creator.sk);
  await algodClient.sendRawTransaction(signedTransaction).do();
  await algosdk.waitForConfirmation(algodClient, txn.txID().toString(), 3);

  const result = await algosdk.waitForConfirmation(
    algodClient,
    txn.txID().toString(),
    3
  );

  const assetIndex = result.assetIndex;
  console.log(`Asset ID created: ${assetIndex}`);
  return assetIndex;
}

async function optInAsset(assetIndex, sender) {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: sender.addr.toString(),
    receiver: sender.addr,
    suggestedParams,
    assetIndex,
    amount: 0,
  });

  const signedOptInTxn = optInTxn.signTxn(sender.sk);
  const { txid } = await algodClient.sendRawTransaction(signedOptInTxn).do();
  await algosdk.waitForConfirmation(algodClient, txid, 3);
  return txid;
}

async function transferAsset(assetIndex, sender, to, amount) {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const xferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: sender.addr.toString(),
    receiver: to,
    suggestedParams,
    assetIndex,
    amount: amount,
  });

  const signedXferTxn = xferTxn.signTxn(sender.sk);
  const { txid } = await algodClient.sendRawTransaction(signedXferTxn).do();
  await algosdk.waitForConfirmation(algodClient, xferTxn.txID().toString(), 3);
  return txid;
}

async function freezeAsset(assetIndex, manager, target) {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const freezeTxn = algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
    sender: manager.addr.toString(),
    suggestedParams,
    assetIndex,
    // freezeState: false would unfreeze the account's asset holding
    frozen: true,
    // freezeTarget is the account that is being frozen or unfrozen
    freezeTarget: target,
  });

  const signedFreezeTxn = freezeTxn.signTxn(manager.sk);
  const { txid } = await algodClient.sendRawTransaction(signedFreezeTxn).do();
  await algosdk.waitForConfirmation(algodClient, txid, 3);
  return txid;
}
async function main() {
  const A = algosdk.generateAccount();
  const B = algosdk.generateAccount();

  console.log("Generated Account");

  console.log("Funding Accounts...");

  const fundA = await fundWallet(A.addr.toString(), 10);
  const fundB = await fundWallet(B.addr.toString(), 10);

  console.log(`Wallets funded with ids: A:${fundA}, B:${fundB}`);

  console.log("Creating asset ...");
  const assetId = await createAsset(A, "TEST Token", "TST", 1000000, 0);
  console.log(`Asset created with assetId ${assetId}`);

  console.log("Opting in ...");
  const optIn = await optInAsset(assetId, B);
  console.log(`Opt in successful at ${optIn}`);

  console.log("tranferring asset ...");
  const transfer = await transferAsset(assetId, A, B.addr.toString(), 1);
  console.log(`transfer successful at ${transfer}`);

  console.log("freezing Asset");
  const freeze = await freezeAsset(assetId, A, B.addr.toString());
  console.log(`freezing successful at ${freeze}`);
}

//run it
main();
