/**
 * One-off / CI helper: expands lib/game/questions/bank.json to ≥50 rows per bossIndex.
 * Run: node scripts/expand-game-bank.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bankPath = path.join(__dirname, "../lib/game/questions/bank.json");

const existing = JSON.parse(fs.readFileSync(bankPath, "utf8"));
const seen = new Set(existing.map((q) => q.id));

const packs = {
  0: {
    difficulty: 1,
    tf: [
      ["Pyth is a pull oracle: prices land on-chain when someone requests an update.", true],
      ["Pyth relies on third-party scrapers copying public websites for prices.", false],
      ["On Solana, Pyth updates roughly every 400ms, near the chain block time.", true],
      ["The PYTH token is mainly used for on-chain governance via the Pyth DAO.", true],
      ["Pyth data is available on more than 50 blockchains.", true],
      ["Pyth depends on a single publisher monopoly for each asset.", false],
      ["A printed price of $100 ± $0.05 encodes a confidence interval around fair value.", true],
      ["The Pythians is the name of the official Pyth community.", true],
      ["One company controls all Pyth price feeds end-to-end.", false],
      ["Historical Pyth updates on-chain are permanently auditable.", true],
      ["Pull oracles can be more gas-efficient than naive push-every-block models.", true],
      ["Major DeFi protocols use Pyth to secure large amounts of value.", true],
      ["The original Pyth whitepaper dropped in 2021.", true],
      ["Publishers must demonstrate access to real trading data.", true],
      ["Pyth supplies a smoothed EMA to reduce noise from tiny wicks.", true],
      ["Pyth aggregation source code is open-source on GitHub.", true],
      ["Hermes is an API service for fetching Pyth prices to EVM and Move chains.", true],
      ["Pyth's mission is to make financial market data available on-chain broadly.", true],
      ["Pyth began on Solana for speed and low fees.", true],
      ["Publisher updates are cryptographically signed.", true],
      ["Pyth only works on Ethereum mainnet.", false],
      ["Anyone can publish any price without accountability.", false],
      ["Confidence intervals can widen when markets are chaotic.", true],
      ["Feed IDs are opaque and should never be reused in code.", false],
    ],
    mcq: [
      [
        "What does it mean that Pyth is a pull oracle?",
        [
          "Validators push every price every block regardless of usage",
          "Consumers fetch or include updates when they need fresh prices",
          "Prices exist only off-chain and never reach contracts",
          "Only the Pyth DAO can read prices",
        ],
        1,
        "pull-oracle",
      ],
      [
        "Who typically publishes prices to Pyth?",
        [
          "Anonymous forum users",
          "Institutions and market makers with first-party trade flow",
          "Only retail wallet addresses",
          "NFT minters exclusively",
        ],
        1,
        "publishers",
      ],
      [
        "Roughly how fast do Pyth prices update on Solana?",
        ["Once per day", "About every 400ms", "Every 10 minutes", "Only on Sundays"],
        1,
        "speed",
      ],
      [
        "What is a primary on-chain use of the PYTH token?",
        [
          "Paying all oracle gas on every chain",
          "Governance over the Pyth DAO",
          "Minting USDC",
          "Replacing ETH as gas",
        ],
        1,
        "token",
      ],
      [
        "Pyth is designed to serve data across:",
        ["Only one L2", "Many blockchains", "Email inboxes", "DNS roots only"],
        1,
        "chains",
      ],
      [
        "Why does Pyth emphasize first-party publisher data?",
        [
          "It is cheaper than scraping",
          "It comes from venues that actually trade the asset",
          "It removes the need for signatures",
          "It disables confidence intervals",
        ],
        1,
        "trust",
      ],
      [
        "What does Hermes provide?",
        [
          "A Solidity compiler",
          "A web service to retrieve Pyth price updates",
          "A centralized exchange order book",
          "NFT metadata hosting",
        ],
        1,
        "hermes",
      ],
      [
        "Pythnet is best described as:",
        [
          "A meme coin",
          "An app-chain that aggregates publisher data before delivery",
          "A wallet browser extension",
          "A Twitter bot",
        ],
        1,
        "feeds",
      ],
      [
        "Why might two dApps see the same Pyth price on different chains?",
        [
          "They phone the same friend",
          "Aggregation on Pythnet yields one aggregate before cross-chain delivery",
          "Chains share private keys",
          "Prices are copied from stock photos",
        ],
        1,
        "feeds",
      ],
      [
        "Staleness of an update matters because:",
        [
          "It changes the chain's consensus algorithm",
          "Risk systems need to know how old the mark is",
          "It disables Entropy",
          "It removes publisher fees",
        ],
        1,
        "feeds",
      ],
    ],
  },
  1: {
    difficulty: 2,
    tf: [
      ["Pyth can cover US equities like TSLA during extended sessions.", true],
      ["Pyth offers metals and energy commodity benchmarks.", true],
      ["Fast oracle marks can support large prediction-market style products.", true],
      ["Liquid staking tokens like jitoSOL can appear as Pyth feeds.", true],
      ["Confidence bands may widen during violent market moves.", true],
      ["Pyth Pro targets institutional-grade, low-latency consumers.", true],
      ["FX pairs such as EUR/USD can be priced on Pyth.", true],
      ["Wormhole is used to relay Pyth aggregates to other chains.", true],
      ["Tokenized T-bills and similar RWAs can have Pyth marks.", true],
      ["Pyth Benchmarks support historical point-in-time lookups.", true],
      ["Pyth lists hundreds of feeds across asset classes.", true],
      ["Equity indices like S&P 500 can be represented.", true],
      ["If a publisher stops contributing, the feed can go stale.", true],
      ["Developers can enforce slippage using cross-publisher deviation.", true],
      ["The same aggregate is intended to be consistent across supported chains.", true],
      ["Pyth only lists two crypto assets total.", false],
      ["Lazer streams ignore bid and ask entirely.", false],
      ["RWA feeds are impossible on Pyth.", false],
      ["FX requires a centralized bank API key on-chain.", false],
      ["Benchmarks are only for meme coins.", false],
      ["Polymarket-style venues never care about oracle latency.", false],
      ["Extended-hours stock marks are useless for DeFi.", false],
      ["Wormhole is only for NFT images.", false],
      ["Publisher deviation rules are meaningless.", false],
      ["Fog mode in Orra is unrelated to confidence.", false],
    ],
    mcq: [
      [
        "What does a widening confidence interval often signal?",
        [
          "Guaranteed arbitrage with no risk",
          "Higher uncertainty or disagreement around the fair price",
          "The feed is about to shut down forever",
          "Gas prices fell to zero",
        ],
        1,
        "confidence",
      ],
      [
        "Pyth Pro / Lazer is primarily built for:",
        [
          "Printing paper tickets",
          "Latency-sensitive, professional data consumers",
          "DNS failover",
          "Social media analytics",
        ],
        1,
        "pro",
      ],
      [
        "Which asset class is explicitly in scope for Pyth alongside crypto?",
        ["Only Pokemon cards", "FX, equities, commodities, and more", "Only weather", "Only sports scores"],
        1,
        "breadth",
      ],
      [
        "Wormhole's role in the Pyth stack is closest to:",
        [
          "Mining Bitcoin",
          "Bridging aggregated results to destination chains",
          "Replacing Solidity",
          "Hosting Discord bots",
        ],
        1,
        "wormhole",
      ],
      [
        "A stale feed label usually means:",
        [
          "The price is guaranteed correct",
          "Updates are too old or publishers are quiet",
          "The asset delisted everywhere on Earth",
          "Gas is free",
        ],
        1,
        "stale",
      ],
      [
        "Benchmarks are useful when you need:",
        [
          "A random meme GIF",
          "A verifiable historical price at a timestamp",
          "To disable signatures",
          "To mine Dogecoin",
        ],
        1,
        "benchmarks",
      ],
      [
        "Cross-publisher deviation rules help protocols:",
        [
          "Ignore all risk",
          "Set guardrails when publishers disagree",
          "Remove confidence intervals",
          "Guarantee 100x leverage",
        ],
        1,
        "deviation",
      ],
      [
        "Tokenized Treasury exposure on-chain might use Pyth for:",
        [
          "Random card draws",
          "Marks and risk parameters",
          "SMTP email",
          "GPU rendering",
        ],
        1,
        "rwa",
      ],
      [
        "Why might identical aggregates appear on multiple chains?",
        [
          "Magic duplication glitch",
          "Single aggregation on Pythnet then delivery cross-chain",
          "Each chain runs a different Excel file",
          "Publishers mail USB sticks",
        ],
        1,
        "consistency",
      ],
      [
        "Extended session equity marks help when:",
        [
          "Only weekend NFT sales matter",
          "You need prices outside regular cash hours",
          "Blockchains turn off at 5pm",
          "Gas is denominated in euros only",
        ],
        1,
        "equities",
      ],
    ],
  },
  2: {
    difficulty: 3,
    tf: [
      ["Entropy V2 offers verifiable on-chain randomness.", true],
      ["Commit-reveal reduces provider front-running of outcomes.", true],
      ["Pyth Lazer can target sub-100ms style delivery configurations.", true],
      ["Aggregation uses a median that drops obvious outliers.", true],
      ["Pythnet is dedicated to oracle aggregation workloads.", true],
      ["Publishers can be weighted by historical accuracy and latency.", true],
      ["Lazer lets operators choose consensus thresholds like 3-of-N.", true],
      ["Far-from-median prints may be treated as outliers.", true],
      ["Final aggregates blend confidence information, not a naive median only.", true],
      ["Publisher latency is monitored to protect freshness.", true],
      ["The design aims for robustness when some publishers misbehave.", true],
      ["Merkle proofs on Pythnet help verify delivered prices.", true],
      ["Entropy can power fair mints, combat, and lotteries.", true],
      ["Each feed has a unique identifier publishers and consumers agree on.", true],
      ["Jane Street, Virtu, and HRT are examples of serious liquidity sources.", true],
      ["Entropy randomness is always predictable in advance.", false],
      ["Lazer only supports one fixed 10s cadence forever.", false],
      ["Outliers are always included with full weight no matter what.", false],
      ["Pythnet is the same chain as Bitcoin.", false],
      ["Publishers never sign their updates.", false],
      ["Median aggregation means the mean of two random numbers.", false],
      ["Entropy cannot be used for NFT mints.", false],
      ["Feed IDs are optional and cosmetic.", false],
      ["BFT-style robustness is irrelevant to oracles.", false],
      ["Lazer consensus thresholds are meaningless decoration.", false],
    ],
    mcq: [
      [
        "Why does Entropy use commit-reveal?",
        [
          "To increase gas for fun",
          "So the provider cannot game the outcome after seeing user intent",
          "To disable smart contracts",
          "To store JPEGs on-chain",
        ],
        1,
        "entropy",
      ],
      [
        "Outlier prices in Pyth aggregation are typically:",
        ["Always averaged in equally", "Dropped when far from the robust center", "The only price used", "Encrypted with AES"],
        1,
        "aggregation",
      ],
      [
        "Pyth Lazer latency targets are best described as:",
        ["Postal mail speed", "Ultra-low-latency streaming configurations", "Annual reports", "FTP batch files"],
        1,
        "lazer",
      ],
      [
        "Publisher weighting may emphasize:",
        [
          "Random Twitter polls",
          "Historical accuracy and low latency",
          "Only wallet age",
          "Only token color",
        ],
        1,
        "publishers",
      ],
      [
        "Pythnet's main job is to:",
        [
          "Host Netflix",
          "Aggregate and attest to oracle data before wider delivery",
          "Mine proof-of-work",
          "Replace DNS",
        ],
        1,
        "pythnet",
      ],
      [
        "A consensus threshold in Lazer helps:",
        [
          "Guarantee infinite leverage",
          "Tune how many publisher voices must agree for a print",
          "Remove signatures",
          "Disable Ethereum",
        ],
        1,
        "lazer",
      ],
      [
        "Merkle proofs in the Pyth stack support:",
        [
          "Proving inclusion of price data roots of trust",
          "3D rendering",
          "SMTP",
          "GPU overclocking",
        ],
        1,
        "integrity",
      ],
      [
        "Entropy is a fit for:",
        [
          "Only static HTML sites",
          "Fair randomness for games, mints, and lotteries",
          "Only tax filings",
          "Only DNS",
        ],
        1,
        "entropy",
      ],
      [
        "Feed IDs matter because:",
        [
          "They are cosmetic emojis",
          "Consumers and contracts must refer to the exact asset channel",
          "They replace private keys",
          "They mine BTC",
        ],
        1,
        "feed-id",
      ],
      [
        "Monitoring publisher latency helps:",
        [
          "Ignore stale risk",
          "Keep delivery fast and flag sluggish sources",
          "Print more USDT",
          "Disable confidence intervals",
        ],
        1,
        "latency",
      ],
    ],
  },
};

function addQuestions() {
  const out = [...existing];
  for (const boss of [0, 1, 2]) {
    const have = out.filter((q) => q.bossIndex === boss).length;
    const need = Math.max(0, 50 - have);
    const pack = packs[boss];
    let n = 0;
    let idx = 0;
    for (const [stem, answerBool] of pack.tf) {
      if (n >= need) break;
      const id = `gen${boss}_tf_${idx++}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        bossIndex: boss,
        type: "tf",
        stem,
        topic: "oracle",
        difficulty: pack.difficulty,
        answerBool,
      });
      n += 1;
    }
    for (const [stem, options, correctIndex, topic] of pack.mcq) {
      if (n >= need) break;
      const id = `gen${boss}_mcq_${idx++}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        bossIndex: boss,
        type: "mcq",
        stem,
        topic,
        difficulty: pack.difficulty,
        options,
        correctIndex,
      });
      n += 1;
    }
    if (n < need) {
      console.error(`Could not synthesize enough questions for boss ${boss}: short by ${need - n}`);
      process.exit(1);
    }
  }
  return out;
}

const merged = addQuestions();
fs.writeFileSync(bankPath, JSON.stringify(merged, null, 2) + "\n");
console.log("Wrote", merged.length, "questions to", bankPath);
