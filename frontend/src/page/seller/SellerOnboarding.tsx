import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Boxes, Camera, Check, PackagePlus, Rocket, Store, Tag, Wallet } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { BRAND } from "../../lib/brand";

const DASHBOARD_PATH = "/seller/dashboard"; // غيّره لمسار لوحة البائع عندك

const STEPS = ["How it works", "Your store", "Add products", "Launch"];

const CATEGORIES = ["Fashion", "Electronics", "Home & Living", "Beauty", "Food & Grocery", "Other"];

const fieldClass =
  "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200";

export default function SellerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [store, setStore] = useState({ name: "", category: CATEGORIES[0], description: "" });

  const isLast = step === STEPS.length - 1;
  const canContinue = step !== 1 || store.name.trim().length >= 2;

  const finish = () => {
    // TODO: ابعت بيانات المتجر (store) للـ API وعلّم إن الـ onboarding خلص
    navigate(DASHBOARD_PATH, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-primary-600">{BRAND}</span>
          <button type="button" onClick={finish} className="text-sm font-medium text-muted hover:text-ink">
            Skip for now
          </button>
        </div>

        {/* شريط الخطوات */}
        <ol className="mb-6 flex items-center gap-2" aria-label="Setup progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i < step
                    ? "bg-primary-600 text-white"
                    : i === step
                      ? "bg-primary-600 text-white ring-4 ring-primary-100"
                      : "bg-slate-200 text-slate-500"
                }`}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`hidden text-xs font-medium sm:block ${i === step ? "text-ink" : "text-muted"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
          {step === 0 && (
            <section>
              <h1 className="text-2xl font-bold text-ink">Welcome! Let's open your store</h1>
              <p className="mt-1 text-sm text-muted">Selling on {BRAND} takes three simple steps.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { icon: Store, title: "Create your store", text: "Pick a name and category so customers can find you." },
                  { icon: PackagePlus, title: "Add your products", text: "Upload photos, set prices and stock levels." },
                  { icon: Wallet, title: "Receive orders & get paid", text: "Manage orders from one dashboard." },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex items-start gap-3 rounded-control border border-line p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{title}</p>
                      <p className="text-sm text-muted">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="text-2xl font-bold text-ink">Tell us about your store</h1>
              <p className="mt-1 text-sm text-muted">You can change all of this later.</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="store-name" className="mb-1.5 block text-sm font-medium text-ink">
                    Store name <span className="text-danger-600">*</span>
                  </label>
                  <Input
                    id="store-name"
                    value={store.name}
                    onChange={(e) => setStore({ ...store, name: e.target.value })}
                    placeholder="e.g. Nour Home Store"
                  />
                </div>
                <div>
                  <label htmlFor="store-category" className="mb-1.5 block text-sm font-medium text-ink">
                    Category
                  </label>
                  <select
                    id="store-category"
                    value={store.category}
                    onChange={(e) => setStore({ ...store, category: e.target.value })}
                    className={fieldClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="store-desc" className="mb-1.5 block text-sm font-medium text-ink">
                    Short description
                  </label>
                  <textarea
                    id="store-desc"
                    rows={3}
                    value={store.description}
                    onChange={(e) => setStore({ ...store, description: e.target.value })}
                    placeholder="What do you sell?"
                    className={fieldClass}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-2xl font-bold text-ink">Tips for great listings</h1>
              <p className="mt-1 text-sm text-muted">You'll add your first product from the dashboard.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { icon: Camera, title: "Clear photos", text: "Use bright, well-lit pictures from several angles." },
                  { icon: Tag, title: "Honest pricing", text: "Set a fair price and mention any shipping fees." },
                  { icon: Boxes, title: "Accurate stock", text: "Keep quantities updated so you never oversell." },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex items-start gap-3 rounded-control border border-line p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{title}</p>
                      <p className="text-sm text-muted">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step === 3 && (
            <section className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Rocket className="h-7 w-7" aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-bold text-ink">You're all set{store.name ? `, ${store.name}` : ""}!</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Head to your dashboard to add your first product and start receiving orders.
              </p>
            </section>
          )}

          {/* أزرار التنقل */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className={step === 0 ? "invisible" : ""}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Back
            </Button>

            {isLast ? (
              <Button type="button" size="lg" onClick={finish}>
                Go to my dashboard
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                Continue
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}