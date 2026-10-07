import xreg from "@/assets/product-art-0.jpg";
import drip from "@/assets/product-art-1.jpg";
import wolf from "@/assets/product-art-2.jpg";
import crystal from "@/assets/product-art-3.jpg";

export const categories = ["All Products", "NON ROOT PANEL", "ROOT PANEL", "IPHONE PANEL", "PC PANEL", "OTHERS ITEM"];
export const products = [
  { id: "xreg", name: "Xreg Android + IOS", category: "NON ROOT PANEL", image: xreg, price: "$0.20", platform: "Android & iOS", art: "violet" },
  { id: "drip", name: "Drip Wire Android", category: "NON ROOT PANEL", image: drip, price: "$0.50", platform: "Android", art: "cyan" },
  { id: "xyz", name: "XYZ APKMOD", category: "NON ROOT PANEL", image: wolf, price: "$0.20", platform: "Android", art: "red" },
  { id: "fluorite", name: "FLUORITE IOS FF", category: "IPHONE PANEL", image: crystal, price: "$5.00", platform: "iOS", art: "blue" },
  { id: "brmod", name: "BR MOD ROOT", category: "ROOT PANEL", image: wolf, price: "$0.70", platform: "Root Android", art: "red" },
  { id: "pc", name: "BRMOD PC", category: "PC PANEL", image: xreg, price: "$1.00", platform: "Windows", art: "violet" },
  { id: "certificate", name: "IPHONE CERTIFICATE", category: "IPHONE PANEL", image: crystal, price: "$10.00", platform: "iOS", art: "blue" },
  { id: "glory", name: "FF GUILD GLORY", category: "OTHERS ITEM", image: drip, price: "$1.30", platform: "Guild", art: "cyan" },
];
export type Product = (typeof products)[number];
