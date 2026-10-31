import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("privacy");

export default function Page() {
  return <PolicyPage slug="privacy" />;
}
