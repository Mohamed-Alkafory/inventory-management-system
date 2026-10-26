import { BarChart3, BellRing, ClipboardList, Package, Store, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Status } from "../../../components/ui/StatusBadge";

/*
  Marketing copy for the Home page. Numbers and wording are placeholders —
  replace them with real figures before launch.
*/

export const HERO_TAGS = [
  { label: "Real-Time Stock Counts", dot: "bg-primary-500" },
  { label: "Orders & Suppliers in One Place", dot: "bg-[#FF8A3D]" },
  { label: "Built for Growing Retailers", dot: "bg-primary-500" },
];

export const ASSURANCES = ["No credit card required", "5-minute guided setup", "Cancel anytime"];

export const STATS = [
  { to: 99.9, decimals: 1, suffix: "%", label: "Stock count accuracy" },
  { to: 3, suffix: "×", label: "Faster order processing" },
  { to: 40, suffix: "%", label: "Less manual data entry" },
  { to: 5, suffix: " min", label: "Average setup time" },
];

export const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Package className="h-6 w-6" />,
    title: "Products Management",
    text: "Organise products, categories and stock levels in one clean catalogue.",
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Order Tracking",
    text: "Follow every order from creation to delivery with real-time status updates.",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Supplier Management",
    text: "Keep suppliers, contracts and purchase orders together and easy to find.",
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Stock Monitoring",
    text: "See live stock levels so you can avoid shortages and overstock.",
  },
  {
    icon: <BellRing className="h-6 w-6" />,
    title: "Low-Stock Alerts",
    text: "Set a reorder level per product and get flagged before you run out.",
  },
  {
    icon: <Store className="h-6 w-6" />,
    title: "Multi-Channel Ready",
    text: "Keep store shelves and online storefronts in sync from a single source of truth.",
  },
];

export const STEPS = [
  {
    title: "Add your products & suppliers",
    text: "Create your catalogue, set categories and reorder levels, and link each product to its supplier.",
  },
  {
    title: "Track stock and orders live",
    text: "Every sale, return and purchase order updates your numbers instantly — no spreadsheets to reconcile.",
  },
  {
    title: "Decide with confidence",
    text: "Spot slow movers and fast sellers, reorder on time and keep customers happy.",
  },
];

export const INSIGHT_POINTS = [
  "Automatic Low Stock and Out of Stock flags",
  "Reorder levels set per product",
  "One view of stock, orders and suppliers",
  "Clear order statuses from pending to delivered",
];

export const ALERTS: { name: string; sku: string; stock: number; reorderAt: number; status: Status }[] = [
  { name: "USB-C Charging Cable", sku: "UC-110", stock: 9, reorderAt: 25, status: "low_stock" },
  { name: "Laptop Stand", sku: "LS-031", stock: 0, reorderAt: 15, status: "out_of_stock" },
  { name: "Wireless Mouse", sku: "WM-204", stock: 142, reorderAt: 40, status: "in_stock" },
];

export const FAQS = [
  {
    q: "How does Prodexa keep stock counts accurate?",
    a: "Every sale, return and purchase order updates stock the moment it happens, so the numbers on screen always match what is on your shelves.",
  },
  {
    q: "Can I manage more than one store or sales channel?",
    a: "Yes. Prodexa is built multi-channel first, so your stores and online storefronts draw from the same stock instead of drifting apart.",
  },
  {
    q: "Do I need technical skills to get started?",
    a: "No. Setup is guided and takes about five minutes — add your products, link your suppliers and you are ready to track.",
  },
  {
    q: "How do low-stock alerts work?",
    a: "You set a reorder level for each product. When stock drops below it, the product is flagged as Low Stock so you can reorder before you run out.",
  },
  {
    q: "Can I try Prodexa before I pay?",
    a: "Absolutely. Start a 14-day free trial — no credit card required — and cancel any time.",
  },
];
