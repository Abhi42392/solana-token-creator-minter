import React, { useState } from "react";
import { Transaction, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

export function SupplyToken() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [supplyData, setSupplyData] = useState({
    mintAddress: "",
    recipientAddress: "",
    amount: "",
    decimals: 9,
  });

  const [isSupplying, setIsSupplying] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txHistory, setTxHistory] = useState([]);

  async function supplyTokens() {
    // Validation
    if (
      !supplyData.mintAddress ||
      !supplyData.recipientAddress ||
      !supplyData.amount
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (!wallet.publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setIsSupplying(true);
    setError("");
    setSuccess("");
    setStatus("Preparing transaction...");

    try {
      // Parse addresses
      let mintPubkey, recipientPubkey;
      try {
        mintPubkey = new PublicKey(supplyData.mintAddress);
        recipientPubkey = new PublicKey(supplyData.recipientAddress);
      } catch {
        throw new Error("Invalid mint or recipient address");
      }

      // Get or create associated token account
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction();

      // Check if ATA exists
      const ataInfo = await connection.getAccountInfo(associatedTokenAccount);
      if (!ataInfo) {
        setStatus("Creating recipient token account...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            associatedTokenAccount,
            recipientPubkey,
            mintPubkey,
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Add mint instruction
      const mintAmount =
        parseFloat(supplyData.amount) * Math.pow(10, supplyData.decimals);
      transaction.add(
        createMintToInstruction(
          mintPubkey,
          associatedTokenAccount,
          wallet.publicKey,
          mintAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      setStatus("Sending transaction...");
      const signature = await wallet.sendTransaction(transaction, connection);

      setStatus("Confirming transaction...");
      await connection.confirmTransaction(signature, "confirmed");

      setSuccess(`Successfully minted ${supplyData.amount} tokens!`);

      // Add to transaction history
      setTxHistory((prev) => [
        ...prev,
        {
          signature: signature,
          amount: supplyData.amount,
          recipient: supplyData.recipientAddress,
          time: new Date().toLocaleTimeString(),
          mint: supplyData.mintAddress.substring(0, 8) + "...",
        },
      ]);

      // Clear form
      setSupplyData({
        ...supplyData,
        recipientAddress: "",
        amount: "",
      });
      setStatus("");
    } catch (err) {
      console.error("Error supplying tokens:", err);
      setError(`Failed to supply tokens: ${err.message}`);
      setStatus("");
    } finally {
      setIsSupplying(false);
    }
  }

  const buttonDisabled = isSupplying || !wallet.publicKey;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black to-neutral-900 p-5">
      <div className="w-full max-w-[600px] rounded-2xl border-2 border-amber-400 bg-black/90 p-10 shadow-[0_0_40px_rgba(255,215,0,0.3)]">
        <h1 className="mb-2 text-center text-4xl font-bold tracking-[0.12em] bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent">
          SUPPLY TOKEN
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
          Mint tokens to any Solana wallet
        </p>

        {/* Token Mint Address */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-400">
            Token Mint Address
          </label>
          <input
            type="text"
            placeholder="Enter token mint address"
            value={supplyData.mintAddress}
            onChange={(e) =>
              setSupplyData({ ...supplyData, mintAddress: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 font-mono"
          />
        </div>

        {/* Recipient Address */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-400">
            Recipient Wallet Address
          </label>
          <input
            type="text"
            placeholder="Enter recipient wallet address"
            value={supplyData.recipientAddress}
            onChange={(e) =>
              setSupplyData({ ...supplyData, recipientAddress: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 font-mono"
          />
        </div>

        {/* Amount and Decimals Row */}
        <div className="mb-7 grid grid-cols-3 gap-4">
          {/* Amount */}
          <div className="col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-400">
              Amount
            </label>
            <input
              type="number"
              placeholder="Enter amount to mint"
              value={supplyData.amount}
              onChange={(e) =>
                setSupplyData({ ...supplyData, amount: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
            />
          </div>

          {/* Decimals */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-400">
              Decimals
            </label>
            <input
              type="number"
              placeholder="9"
              value={supplyData.decimals}
              onChange={(e) =>
                setSupplyData({
                  ...supplyData,
                  decimals: parseInt(e.target.value, 10) || 9,
                })
              }
              min={0}
              max={9}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
        </div>

        {/* Supply Button */}
        <button
          onClick={supplyTokens}
          disabled={buttonDisabled}
          className={[
            "w-full rounded-lg px-5 py-4 text-base font-bold uppercase tracking-wide transition",
            "focus:outline-none focus:ring-2 focus:ring-amber-400/40",
            buttonDisabled
              ? "cursor-not-allowed bg-neutral-800 text-neutral-400"
              : "bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-[0_4px_15px_rgba(255,215,0,0.4)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(255,215,0,0.6)] active:translate-y-0",
          ].join(" ")}
        >
          {!wallet.publicKey
            ? "Connect Wallet"
            : isSupplying
            ? "Supplying..."
            : "Supply Tokens"}
        </button>

        {/* Status Messages */}
        {status && (
          <div className="mt-5 rounded-lg border border-amber-400 bg-amber-400/10 p-3 text-center text-sm text-amber-400">
            {status}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-500 bg-red-500/10 p-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-400/10 p-4 text-center">
            <div className="text-base font-bold text-amber-400">
              ✨ {success}
            </div>
          </div>
        )}

        {/* Transaction History */}
        {txHistory.length > 0 && (
          <div className="mt-7 rounded-xl border border-neutral-700 bg-black p-5">
            <h3 className="mb-4 text-base font-bold uppercase tracking-wider text-amber-400">
              Transaction History
            </h3>
            <div className="max-h-52 overflow-y-auto space-y-2">
              {txHistory.map((tx, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 transition hover:border-amber-400"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-amber-400">
                      {tx.amount} tokens
                    </span>
                    <span className="text-xs text-neutral-500">{tx.time}</span>
                  </div>
                  <div className="mb-1 text-xs text-neutral-400">
                    To: {tx.recipient.substring(0, 8)}...
                    {tx.recipient.substring(tx.recipient.length - 6)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Mint: {tx.mint}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplyToken;
