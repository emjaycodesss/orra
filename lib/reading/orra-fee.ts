import { ethers } from "ethers";
import { ORRA_ABI, ORRA_ADDRESS, BASE_RPC_URL, ENTROPY_ADDRESS } from "@/lib/contract";

export async function readOrraFee(): Promise<bigint> {
  if (!ORRA_ADDRESS || !ethers.isAddress(ORRA_ADDRESS)) {
    throw new Error(
      "NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS is missing or not a valid address."
    );
  }

  const providers: ethers.Provider[] = [];
  if (typeof window !== "undefined" && window.ethereum) {
    providers.push(new ethers.BrowserProvider(window.ethereum));
  }
  providers.push(new ethers.JsonRpcProvider(BASE_RPC_URL));

  let lastErr: Error | null = null;
  for (const provider of providers) {
    try {
      return await readFeeWithProvider(provider);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastErr ??
    new Error(
      "Could not read reading fee. Confirm NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS and Base RPC URL match the deployment chain."
    )
  );
}

async function readFeeWithProvider(provider: ethers.Provider): Promise<bigint> {
  const [code, network] = await Promise.all([
    provider.getCode(ORRA_ADDRESS),
    provider.getNetwork().catch(() => null),
  ]);
  if (!code || code === "0x") {
    const chainHint = network ? ` (chain ${network.chainId})` : "";
    throw new Error(
      `No bytecode at Orra (${ORRA_ADDRESS})${chainHint} — ` +
      `deploy the contract or set NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS to the correct address on this network.`
    );
  }

  const orra = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);
  try {
    const fee = await orra.getFee();
    return BigInt(fee.toString());
  } catch (e) {
    let entropyHint = "";
    try {
      const entropyAddr = (await orra.entropy()) as string;
      const canonical = ENTROPY_ADDRESS.toLowerCase();
      entropyHint =
        ` Orra forwards getFee() to entropy at ${entropyAddr}. ` +
        `On Base mainnet the Pyth Entropy v2 contract is ${canonical}. ` +
        `If these differ, redeploy Orra with ENTROPY_ADDRESS from ` +
        `https://docs.pyth.network/entropy/chainlist (see DeployOrra.s.sol). ` +
        `A revert here means entropy.getFeeV2() failed on-chain (wrong Entropy address in Orra’s constructor).`;
    } catch {
      entropyHint =
        " Could not read Orra.entropy(); verify the contract is Orra and the ABI matches.";
    }

    const base =
      e instanceof Error ? e.message : String(e);
    const isCall =
      ethers.isError(e, "CALL_EXCEPTION") ||
      base.includes("execution reverted") ||
      base.includes("CALL_EXCEPTION");

    throw new Error(
      `${base}${isCall ? entropyHint : ""}`
    );
  }
}
