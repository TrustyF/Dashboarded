import ViewHost from "@/components/ViewHost";

// The only real route - see components/ViewHost.tsx and lib/active-view.tsx
// for how the other 6 views actually render and switch (client-side state,
// not routing).
export default function Page() {
  return <ViewHost />;
}
