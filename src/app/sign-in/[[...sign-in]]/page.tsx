import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-neutral-950 px-6 py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-20%,rgba(120,119,198,0.05),rgba(255,255,255,0))]" />
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-4">
        <SignIn
          path="/sign-in"
          appearance={{
            elements: {
              card: "bg-neutral-900 border border-neutral-800 shadow-xl rounded-2xl",
              headerTitle: "text-white font-heading font-medium tracking-tight",
              headerSubtitle: "text-neutral-400 text-sm",
              socialButtonsBlockButton: "border-neutral-850 bg-neutral-950 hover:bg-neutral-850 text-neutral-200 transition-colors",
              formButtonPrimary: "bg-white text-neutral-950 hover:bg-neutral-200 transition-colors rounded-lg text-sm font-semibold",
              formFieldLabel: "text-neutral-300",
              formFieldInput: "bg-neutral-950 border-neutral-800 text-white rounded-lg focus:border-white focus:ring-0",
              footerActionLink: "text-white hover:text-neutral-300",
            },
          }}
        />
      </div>
    </div>
  );
}
