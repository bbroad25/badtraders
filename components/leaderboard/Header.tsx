export default function Header() {
  return (
    <header className="text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-bold text-primary uppercase tracking-tighter text-balance">
          $BADTRADER OF THE WEEK
        </h1>
        <div className="flex items-center justify-center gap-4 text-3xl md:text-4xl">
          <span>😂</span>
          <span>😭</span>
          <span>😂</span>
        </div>
      </div>
      <p className="text-xl md:text-2xl font-bold uppercase tracking-tight text-balance text-muted-foreground">
        THE ONLY COMPETITION WHERE LOSING MAKES YOU A WINNER
      </p>
    </header>
  );
}

