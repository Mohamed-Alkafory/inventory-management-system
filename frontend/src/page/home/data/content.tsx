import { BarChart3, BellRing, ClipboardList, MessageSquare, Package, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Status } from "../../../components/ui/StatusBadge";

/*
  Marketing copy for the Home page. Wording and sample figures are
  placeholders — keep them aligned with what the product actually does.
*/

export const HERO_TAGS = [
  { label: "Live Stock Counts", dot: "bg-primary-500" },
  { label: "Orders & Suppliers in One Place", dot: "bg-[#FF8A3D]" },
  { label: "Built for Growing Retailers", dot: "bg-primary-500" },
];

export const ASSURANCES = ["Role-based access", "5-minute guided setup", "Full stock history"];

export const ROLES: { icon: ReactNode; title: string; text: string; points: string[] }[] = [
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "Admin",
    text: "Owns the setup and the numbers.",
    points: ["Manage users & roles", "Products & suppliers", "Full audit trail"],
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Staff",
    text: "Runs the day-to-day stock work.",
    points: ["Receive purchase orders", "Record sales & returns", "Update stock levels"],
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Support",
    text: "Answers customers and resolves issues.",
    points: ["Shared message inbox", "Track every query", "See order history"],
  },
  {
    icon: <ShoppingBag className="h-6 w-6" />,
    title: "Customer",
    text: "Shops and follows their own orders.",
    points: ["Browse the catalogue", "Place orders", "Follow order status"],
  },
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
    text: "Follow every order from pending to confirmed or cancelled, with a full item and stock history.",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Supplier Management",
    text: "Keep suppliers and purchase orders together, and receive stock when it arrives.",
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Stock Monitoring",
    text: "See live stock levels and a complete movement history for every product.",
  },
  {
    icon: <BellRing className="h-6 w-6" />,
    title: "Low-Stock Alerts",
    text: "Set a reorder level per product and get flagged before you run out.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "Role-Based Access",
    text: "Give admins, staff, support and customers exactly the access each role needs.",
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
  "Clear order statuses from pending to confirmed or cancelled",
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
    q: "Can my team use the system with different roles?",
    a: "Yes. Admin, staff, support and customer accounts each see only the tools and records their role allows.",
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
    q: "How do I get started with Prodexa?",
    a: "Create a customer account to browse the catalogue and place orders, or contact us to arrange a walkthrough for your team.",
  },
];
