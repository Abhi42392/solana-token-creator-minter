import React, { useState } from "react";
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export default function TokenCreation() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [tokenData, setTokenData] = useState({
    name: "",
    symbol: "",
    imageUrl: "",
    decimals: 9,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [mintAddress, setMintAddress] = useState("");

  async function createToken() {
    if (!tokenData.name || !tokenData.symbol) {
      setError("Please fill in all required fields");
      return;
    }

    if (!wallet.publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setIsCreating(true);
    setStatus("Preparing transaction...");
    setError("");
    setMintAddress("");

    try {
      const mintKeypair = Keypair.generate();

      setStatus("Calculating rent...");
      const lamports = await getMinimumBalanceForRentExemptMint(connection);

      const transaction = new Transaction();

      // Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(
          mintKeypair.publicKey,
          tokenData.decimals,
          wallet.publicKey,
          wallet.publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      // Add Metaplex metadata
      setStatus("Adding metadata...");
      const [metadataAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      transaction.add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataAccount,
            mint: mintKeypair.publicKey,
            mintAuthority: wallet.publicKey,
            payer: wallet.publicKey,
            updateAuthority: wallet.publicKey,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: tokenData.name,
                symbol: tokenData.symbol,
                uri: tokenData.imageUrl,
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          }
        )
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = blockhash;
      transaction.partialSign(mintKeypair);

      setStatus("Sending transaction...");
      const signature = await wallet.sendTransaction(transaction, connection);

      setStatus("Confirming transaction...");
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      setMintAddress(mintKeypair.publicKey.toString());
      setStatus("");

      // Clear form
      setTokenData({
        name: "",
        symbol: "",
        imageUrl: "",
        decimals: 9,
      });
    } catch (err) {
      console.error("Error creating token:", err);
      setError(`Failed to create token: ${err.message || err}`);
      setStatus("");
    } finally {
      setIsCreating(false);
    }
  }

  const buttonDisabled = isCreating || !wallet.publicKey;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black to-neutral-900 p-5">
      <div className="w-full max-w-[500px] rounded-2xl border-2 border-amber-400 bg-black/90 p-10 shadow-[0_0_40px_rgba(255,215,0,0.3)]">
        <h1 className="text-center text-4xl font-bold tracking-[0.12em] mb-2 bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent">
          CREATE TOKEN
        </h1>
        <p className="text-center text-sm text-neutral-400 mb-8">
          Deploy your SPL token with Metaplex metadata
        </p>

        {/* Name Input */}
        <div className="mb-5">
          <label className="block mb-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            Token Name
          </label>
          <input
            type="text"
            placeholder="Enter token name"
            value={tokenData.name}
            onChange={(e) =>
              setTokenData({ ...tokenData, name: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white text-base outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
        </div>

        {/* Symbol Input */}
        <div className="mb-5">
          <label className="block mb-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            Token Symbol
          </label>
          <input
            type="text"
            placeholder="Enter token symbol"
            value={tokenData.symbol}
            onChange={(e) =>
              setTokenData({ ...tokenData, symbol: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white text-base outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
        </div>

        {/* Image URL Input */}
        <div className="mb-5">
          <label className="block mb-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            Image URL
          </label>
          <input
            type="text"
            placeholder="https://example.com/image.png"
            value={tokenData.imageUrl}
            onChange={(e) =>
              setTokenData({ ...tokenData, imageUrl: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white text-base outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
        </div>

        {/* Decimals Input */}
        <div className="mb-7">
          <label className="block mb-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            Decimals
          </label>
          <input
            type="number"
            placeholder="9"
            value={tokenData.decimals}
            onChange={(e) =>
              setTokenData({
                ...tokenData,
                decimals: parseInt(e.target.value, 10) || 9,
              })
            }
            min={0}
            max={9}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white text-base outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={createToken}
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
            : isCreating
            ? "Creating..."
            : "Create Token"}
        </button>

        {/* Status Message */}
        {status && (
          <div className="mt-5 rounded-lg border border-amber-400 bg-amber-400/10 p-3 text-center text-sm text-amber-400">
            {status}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-5 rounded-lg border border-red-500 bg-red-500/10 p-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Success Message */}
        {mintAddress && (
          <div className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-400/10 p-4 text-center">
            <div className="mb-2 text-base font-bold text-amber-400">
              ✨ TOKEN CREATED SUCCESSFULLY!
            </div>
            <div className="mb-1 text-[12px] text-neutral-400">
              Token Mint Address:
            </div>
            <div className="mt-1 break-words rounded-md bg-black p-2 font-mono text-[11px] text-orange-400">
              {mintAddress}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
