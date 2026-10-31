import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("shipping");

export default function Page() {
  return <PolicyPage slug="shipping" />;
}
