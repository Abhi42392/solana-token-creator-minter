import { useState } from "react";

import "./App.css";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Routes, Route } from "react-router-dom";
import TokenLaunchPad from "./components/TokenLaunchPad";
import TokenCreation from "./components/TokenCreation";
import Home from "./components/Home";
import SupplyToken from "./components/SupplyToken";
function App() {
  return (
    <ConnectionProvider endpoint={"https://api.devnet.solana.com/"}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <WalletMultiButton />
          {/* <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create-token" element={<TokenCreation />} />
            <Route path="/supply-token" element={<SupplyToken />} />
          </Routes> */}
          <TokenLaunchPad />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
