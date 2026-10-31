import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("refunds");

export default function Page() {
  return <PolicyPage slug="refunds" />;
}
