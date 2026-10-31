import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("about");

export default function Page() {
  return <PolicyPage slug="about" />;
}
