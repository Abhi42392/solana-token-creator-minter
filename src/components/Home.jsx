import React from "react";
import { NavLink } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
const Home = () => {
  return (
    <div>
      <nav className="space-x-4 m-2">
        <WalletMultiButton />
        <NavLink to={"/create-token"}>
          <button className="rounded-md bg-white text-black  p-3">
            Create Token
          </button>
        </NavLink>
        <NavLink to={"/supply-token"}>
          <button className="rounded-md bg-orange-400 text-black p-3">
            Supply Tokens
          </button>
        </NavLink>
      </nav>
    </div>
  );
};

export default Home;
