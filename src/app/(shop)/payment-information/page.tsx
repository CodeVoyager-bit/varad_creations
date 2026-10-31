import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("payments");

export default function Page() {
  return <PolicyPage slug="payments" />;
}
