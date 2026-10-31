import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("faq");

export default function Page() {
  return <PolicyPage slug="faq" />;
}
