import React, { useState } from "react";
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

// Token-2022 imports
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  TYPE_SIZE,
  LENGTH_SIZE,
  ExtensionType,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";

// Metaplex imports
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export function TokenCreatorAndMinter() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // State for form inputs
  const [tokenData, setTokenData] = useState({
    name: "",
    symbol: "",
    imageUrl: "",
    decimals: 9,
    initialSupply: "",
  });

  // State for minting after creation
  const [mintingData, setMintingData] = useState({
    recipientAddress: "",
    mintAmount: "",
  });

  const [tokenStandard, setTokenStandard] = useState("token2022");
  const [currentMint, setCurrentMint] = useState(null);
  const [showMintingSection, setShowMintingSection] = useState(false);

  // State for UI feedback
  const [isCreating, setIsCreating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txHistory, setTxHistory] = useState([]);

  // Create Token-2022 with initial mint
  async function createAndMintToken2022() {
    const mintKeypair = Keypair.generate();

    // Create metadata object
    const metadata = {
      mint: mintKeypair.publicKey,
      name: tokenData.name,
      symbol: tokenData.symbol,
      uri: tokenData.imageUrl,
      additionalMetadata: [],
    };

    setStatus("Setting up Token-2022 with metadata...");
    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );

    // Start building transaction
    const transaction = new Transaction();

    // Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey,
        wallet.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenData.decimals,
        wallet.publicKey,
        wallet.publicKey, // freeze authority
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mintKeypair.publicKey,
        metadata: mintKeypair.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      })
    );

    // If initial supply is specified, create ATA and mint
    if (tokenData.initialSupply && parseFloat(tokenData.initialSupply) > 0) {
      setStatus("Preparing initial token mint...");

      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // Create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      );

      // Mint initial supply
      const mintAmount =
        parseFloat(tokenData.initialSupply) * Math.pow(10, tokenData.decimals);
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    // Send transaction
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction.partialSign(mintKeypair);

    setStatus("Sending transaction...");
    const signature = await wallet.sendTransaction(transaction, connection);

    setStatus("Confirming transaction...");
    await connection.confirmTransaction(signature, "confirmed");

    return { mint: mintKeypair.publicKey, signature };
  }

  // Create SPL Token with initial mint
  async function createAndMintSPLToken() {
    const mintKeypair = Keypair.generate();

    setStatus("Setting up SPL Token...");
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
    setStatus("Adding Metaplex metadata...");
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

    // If initial supply is specified, create ATA and mint
    if (tokenData.initialSupply && parseFloat(tokenData.initialSupply) > 0) {
      setStatus("Preparing initial token mint...");

      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      // Create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintKeypair.publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      // Mint initial supply
      const mintAmount =
        parseFloat(tokenData.initialSupply) * Math.pow(10, tokenData.decimals);
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    // Send transaction
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

    return { mint: mintKeypair.publicKey, signature };
  }

  // Main create token function
  async function createToken() {
    if (!tokenData.name || !tokenData.symbol || !tokenData.imageUrl) {
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
    setSuccess("");

    try {
      let result;

      if (tokenStandard === "token2022") {
        result = await createAndMintToken2022();
      } else {
        result = await createAndMintSPLToken();
      }

      setCurrentMint(result.mint);
      setShowMintingSection(true);

      const successMsg = `Token created successfully! Mint: ${result.mint.toString()}`;
      if (tokenData.initialSupply && parseFloat(tokenData.initialSupply) > 0) {
        setSuccess(
          `${successMsg}\nMinted ${tokenData.initialSupply} tokens to your wallet!`
        );
      } else {
        setSuccess(successMsg);
      }

      setTxHistory((prev) => [
        ...prev,
        {
          type: "Creation",
          signature: result.signature,
          amount: tokenData.initialSupply || "0",
          recipient: wallet.publicKey.toString(),
          time: new Date().toLocaleTimeString(),
        },
      ]);

      setStatus("");
    } catch (err) {
      console.error("Error creating token:", err);
      setError(`Failed to create token: ${err.message}`);
      setStatus("");
    } finally {
      setIsCreating(false);
    }
  }

  // Mint additional tokens
  async function mintAdditionalTokens() {
    if (!mintingData.recipientAddress || !mintingData.mintAmount) {
      setError("Please enter recipient address and amount");
      return;
    }

    if (!currentMint) {
      setError("No token created yet");
      return;
    }

    setIsMinting(true);
    setError("");
    setStatus("Preparing to mint tokens...");

    try {
      let recipientPubkey;
      try {
        recipientPubkey = new PublicKey(mintingData.recipientAddress);
      } catch {
        throw new Error("Invalid recipient address");
      }

      const programId =
        tokenStandard === "token2022"
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

      // Get or create associated token account
      const associatedTokenAccount = await getAssociatedTokenAddress(
        currentMint,
        recipientPubkey,
        false,
        programId
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
            currentMint,
            programId
          )
        );
      }

      // Add mint instruction
      const mintAmount =
        parseFloat(mintingData.mintAmount) * Math.pow(10, tokenData.decimals);
      transaction.add(
        createMintToInstruction(
          currentMint,
          associatedTokenAccount,
          wallet.publicKey,
          mintAmount,
          [],
          programId
        )
      );

      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      setStatus("Sending minting transaction...");
      const signature = await wallet.sendTransaction(transaction, connection);

      setStatus("Confirming transaction...");
      await connection.confirmTransaction(signature, "confirmed");

      setSuccess(
        `Successfully minted ${mintingData.mintAmount} tokens to ${mintingData.recipientAddress}`
      );

      setTxHistory((prev) => [
        ...prev,
        {
          type: "Mint",
          signature: signature,
          amount: mintingData.mintAmount,
          recipient: mintingData.recipientAddress,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      // Clear minting form
      setMintingData({ recipientAddress: "", mintAmount: "" });
      setStatus("");
    } catch (err) {
      console.error("Error minting tokens:", err);
      setError(`Failed to mint tokens: ${err.message}`);
      setStatus("");
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "40px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            marginBottom: "30px",
            textAlign: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Token Creator & Minter
        </h1>

        {/* Token Creation Section */}
        {!showMintingSection && (
          <div>
            {/* Token Standard Selection */}
            <div style={{ marginBottom: "25px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "10px",
                  fontWeight: "600",
                }}
              >
                Select Token Standard
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setTokenStandard("token2022")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border:
                      tokenStandard === "token2022"
                        ? "2px solid #667eea"
                        : "1px solid #e0e0e0",
                    borderRadius: "8px",
                    background:
                      tokenStandard === "token2022" ? "#f0f4ff" : "white",
                    color: tokenStandard === "token2022" ? "#667eea" : "#666",
                    fontWeight: tokenStandard === "token2022" ? "600" : "400",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                >
                  Token-2022
                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "4px",
                      fontWeight: "400",
                    }}
                  >
                    (With Extensions)
                  </div>
                </button>
                <button
                  onClick={() => setTokenStandard("spl")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border:
                      tokenStandard === "spl"
                        ? "2px solid #667eea"
                        : "1px solid #e0e0e0",
                    borderRadius: "8px",
                    background: tokenStandard === "spl" ? "#f0f4ff" : "white",
                    color: tokenStandard === "spl" ? "#667eea" : "#666",
                    fontWeight: tokenStandard === "spl" ? "600" : "400",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                >
                  SPL Token
                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "4px",
                      fontWeight: "400",
                    }}
                  >
                    (With Metaplex)
                  </div>
                </button>
              </div>
            </div>

            {/* Token Details */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                Token Name *
              </label>
              <input
                type="text"
                placeholder="e.g., My Token"
                value={tokenData.name}
                onChange={(e) =>
                  setTokenData({ ...tokenData, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                Token Symbol *
              </label>
              <input
                type="text"
                placeholder="e.g., MTK"
                value={tokenData.symbol}
                onChange={(e) =>
                  setTokenData({ ...tokenData, symbol: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                Image URL / Metadata URI *
              </label>
              <input
                type="text"
                placeholder="https://example.com/image.png"
                value={tokenData.imageUrl}
                onChange={(e) =>
                  setTokenData({ ...tokenData, imageUrl: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Decimals
                </label>
                <input
                  type="number"
                  placeholder="9"
                  value={tokenData.decimals}
                  onChange={(e) =>
                    setTokenData({
                      ...tokenData,
                      decimals: parseInt(e.target.value) || 9,
                    })
                  }
                  min="0"
                  max="9"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Initial Supply (Optional)
                </label>
                <input
                  type="number"
                  placeholder="1000000"
                  value={tokenData.initialSupply}
                  onChange={(e) =>
                    setTokenData({
                      ...tokenData,
                      initialSupply: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              onClick={createToken}
              disabled={isCreating || !wallet.publicKey}
              style={{
                width: "100%",
                padding: "14px",
                background:
                  isCreating || !wallet.publicKey
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "18px",
                fontWeight: "600",
                cursor:
                  isCreating || !wallet.publicKey ? "not-allowed" : "pointer",
                marginTop: "20px",
              }}
            >
              {!wallet.publicKey
                ? "Connect Wallet First"
                : isCreating
                ? "Creating & Minting..."
                : "Create Token"}
            </button>
          </div>
        )}

        {/* Minting Section */}
        {showMintingSection && currentMint && (
          <div>
            <div
              style={{
                padding: "15px",
                background: "#f8f9fa",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{ fontSize: "14px", color: "#666", marginBottom: "5px" }}
              >
                Current Token
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  wordBreak: "break-all",
                }}
              >
                {currentMint.toString()}
              </div>
              <div style={{ marginTop: "10px", fontSize: "14px" }}>
                <strong>{tokenData.name}</strong> ({tokenData.symbol})
              </div>
            </div>

            <h3 style={{ marginBottom: "20px", color: "#333" }}>
              Mint Additional Tokens
            </h3>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                Recipient Address
              </label>
              <input
                type="text"
                placeholder="Solana wallet address"
                value={mintingData.recipientAddress}
                onChange={(e) =>
                  setMintingData({
                    ...mintingData,
                    recipientAddress: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                Amount to Mint
              </label>
              <input
                type="number"
                placeholder="1000"
                value={mintingData.mintAmount}
                onChange={(e) =>
                  setMintingData({ ...mintingData, mintAmount: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={mintAdditionalTokens}
                disabled={isMinting}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: isMinting ? "#9ca3af" : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: isMinting ? "not-allowed" : "pointer",
                }}
              >
                {isMinting ? "Minting..." : "Mint Tokens"}
              </button>

              <button
                onClick={() => {
                  setShowMintingSection(false);
                  setCurrentMint(null);
                  setTokenData({
                    name: "",
                    symbol: "",
                    imageUrl: "",
                    decimals: 9,
                    initialSupply: "",
                  });
                }}
                style={{
                  padding: "12px 20px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Create New Token
              </button>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "#f0f9ff",
              border: "1px solid #3b82f6",
              borderRadius: "8px",
              color: "#1e40af",
              fontSize: "14px",
            }}
          >
            {status}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "#fef2f2",
              border: "1px solid #ef4444",
              borderRadius: "8px",
              color: "#991b1b",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "#f0fdf4",
              border: "1px solid #22c55e",
              borderRadius: "8px",
              color: "#166534",
              fontSize: "14px",
              whiteSpace: "pre-line",
            }}
          >
            {success}
          </div>
        )}

        {/* Transaction History */}
        {txHistory.length > 0 && (
          <div
            style={{
              marginTop: "30px",
              padding: "20px",
              background: "#f9fafb",
              borderRadius: "8px",
            }}
          >
            <h4 style={{ marginBottom: "15px", color: "#333" }}>
              Transaction History
            </h4>
            {txHistory.map((tx, index) => (
              <div
                key={index}
                style={{
                  padding: "10px",
                  marginBottom: "10px",
                  background: "white",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "5px",
                  }}
                >
                  <strong>{tx.type}</strong>
                  <span style={{ color: "#666", fontSize: "12px" }}>
                    {tx.time}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  Amount: {tx.amount} tokens
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    wordBreak: "break-all",
                  }}
                >
                  To: {tx.recipient}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TokenCreatorAndMinter;
