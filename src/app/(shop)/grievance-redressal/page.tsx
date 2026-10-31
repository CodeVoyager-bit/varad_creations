import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("grievance");

export default function Page() {
  return <PolicyPage slug="grievance" />;
}
