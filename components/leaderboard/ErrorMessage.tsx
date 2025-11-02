interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="bg-destructive/20 border-4 border-destructive px-6 py-4 relative mt-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]" role="alert">
      <strong className="font-bold uppercase text-destructive-foreground">Error: </strong>
      <span className="block sm:inline text-destructive-foreground uppercase">{message}</span>
    </div>
  );
}

