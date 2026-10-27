import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Boxes, FolderTree, PackageCheck, PackageX, Plus, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productsApi } from "../../../api/productsApi";
import { Button, EmptyState, ErrorState, Skeleton, StatusBadge } from "../../../components/ui";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { buttonClass } from "../../../components/ui/buttonClass";
import { useAuth } from "../../../context/auth/useAuth";
import { categoriesApi } from "../../../features/products/categories/api";
import { suppliersApi } from "../../../features/products/suppliers/api";
import { cn } from "../../../lib/cn";
import type { InventoryProduct, ProductQuery, StockStatus } from "../../../types/inventory";

const base: ProductQuery = { search: "", category: "", status: "", sortBy: null, sortDir: "asc", page: 1, pageSize: 1 };

/*
  The dashboard only asks the server for counts (page size 1 → read `total`) and two short
  lists, so it stays fast however big the catalogue gets.
*/
async function loadStats() {
  const count = (status: StockStatus | "") => productsApi.list({ ...base, status }).then((p) => p.total);
  const [all, inStock, low, out, lowList, outList, categories, suppliers] = await Promise.all([
    count(""),
    count("in_stock"),
    count("low_stock"),
    count("out_of_stock"),
    productsApi.list({ ...base, status: "low_stock", pageSize: 6, sortBy: "stock", sortDir: "asc" }),
    productsApi.list({ ...base, status: "out_of_stock", pageSize: 6 }),
    categoriesApi.list({ search: "", page: 1, pageSize: 1 }).then((p) => p.total),
    suppliersApi.list({ search: "", page: 1, pageSize: 1 }).then((p) => p.total),
  ]);
  return { all, inStock, low, out, attention: [...outList.items, ...lowList.items].slice(0, 8), categories, suppliers };
}

type StatProps = { label: string; value: number | undefined; icon: LucideIcon; tone: string; to: string };

function Stat({ label, value, icon: Icon, tone, to }: StatProps) {
  return (
    <Link
      to={to}
      className="group rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-control", tone)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-3 text-3xl font-bold tabular-nums">{value.toLocaleString("en-US")}</p>
      )}
    </Link>
  );
}

function StockBar({ inStock, low, out }: { inStock: number; low: number; out: number }) {
  const total = inStock + low + out;
  if (total === 0) return <p className="text-sm text-muted">No products yet.</p>;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const rows = [
    { label: "In stock", n: inStock, bar: "bg-success-600" },
    { label: "Low stock", n: low, bar: "bg-warning-600" },
    { label: "Out of stock", n: out, bar: "bg-danger-600" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Stock health">
        {rows.map((r) => (
          <div key={r.label} className={r.bar} style={{ width: pct(r.n) }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", r.bar)} aria-hidden="true" />
              {r.label}
            </span>
            <span className="font-semibold tabular-nums">
              {r.n} <span className="font-normal text-muted">({Math.round((r.n / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttentionRow({ p }: { p: InventoryProduct }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{p.name}</p>
        <p className="text-xs text-muted">
          {p.sku} · {p.stock} left (reorder at {p.reorderLevel})
        </p>
      </div>
      <StatusBadge status={p.status} />
    </li>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, isError, refetch } = useQuery({ queryKey: ["products", "admin-dashboard"], queryFn: loadStats, staleTime: 30_000 });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Welcome back, {user?.name}. Here is how your store looks today.</p>
        </div>
        <Link to="/admin/products" className={buttonClass("primary", "md")}>
          <Plus className="size-4" aria-hidden="true" /> Manage products
        </Link>
      </div>

      {isError ? (
        <Card className="mt-6">
          <ErrorState
            title="Couldn't load the dashboard"
            message="Check that the backend is running, then try again."
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Total products" value={data?.all} icon={Boxes} tone="bg-primary-50 text-primary-700" to="/admin/products" />
            <Stat label="In stock" value={data?.inStock} icon={PackageCheck} tone="bg-success-50 text-success-700" to="/admin/products?stock=in_stock" />
            <Stat label="Low stock" value={data?.low} icon={AlertTriangle} tone="bg-warning-50 text-warning-700" to="/admin/products?stock=low_stock" />
            <Stat label="Out of stock" value={data?.out} icon={PackageX} tone="bg-danger-50 text-danger-700" to="/admin/products?stock=out_of_stock" />
            <Stat label="Categories" value={data?.categories} icon={FolderTree} tone="bg-info-50 text-info-700" to="/admin/categories" />
            <Stat label="Suppliers" value={data?.suppliers} icon={Truck} tone="bg-slate-100 text-slate-700" to="/admin/suppliers" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader title="Stock health" description="Share of products by stock level" />
              <CardBody>
                {data ? <StockBar inStock={data.inStock} low={data.low} out={data.out} /> : <Skeleton className="h-24 w-full" />}
              </CardBody>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader
                title="Needs attention"
                description="Out-of-stock and running-low products"
                action={
                  <Link to="/admin/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
                    View all <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                }
              />
              <CardBody className="py-2">
                {!data ? (
                  <Skeleton className="my-3 h-32 w-full" />
                ) : data.attention.length === 0 ? (
                  <EmptyState title="All stocked up" description="No product is low or out of stock." />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.attention.map((p) => (
                      <AttentionRow key={p.id} p={p} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader title="Quick actions" />
            <CardBody className="flex flex-wrap gap-3">
              <Link to="/admin/products" className={buttonClass("primary", "md")}>
                Add / edit products
              </Link>
              <Link to="/admin/categories" className={buttonClass("secondary", "md")}>
                Categories
              </Link>
              <Link to="/admin/suppliers" className={buttonClass("secondary", "md")}>
                Suppliers
              </Link>
              <Button variant="ghost" onClick={() => void refetch()}>
                Refresh numbers
              </Button>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
