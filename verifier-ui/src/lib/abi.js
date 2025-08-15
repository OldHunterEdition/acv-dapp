export const CERT_REGISTRY_ABI = [
  // get(certId) -> Cert struct
  {
    inputs: [{ internalType: "bytes32", name: "certId", type: "bytes32" }],
    name: "get",
    outputs: [
      {
        components: [
          { internalType: "address", name: "issuer", type: "address" },
          { internalType: "string", name: "cid", type: "string" },
          { internalType: "bytes32", name: "contentHash", type: "bytes32" },
          { internalType: "uint64", name: "issuedAt", type: "uint64" },
          { internalType: "uint64", name: "revokedAt", type: "uint64" },
          { internalType: "uint8", name: "status", type: "uint8" },
        ],
        internalType: "struct CertRegistry.Cert",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // optional helper
  {
    inputs: [{ internalType: "bytes32", name: "certId", type: "bytes32" }],
    name: "isActive",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];
