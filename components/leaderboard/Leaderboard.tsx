"use client"

import { LeaderboardEntry } from '@/types/leaderboard';
import { Card } from '@/components/ui/card';

const SkeletonRow = () => (
  <tr className="border-b-4 border-primary animate-pulse">
    <td className="p-4"><div className="h-6 bg-muted rounded w-8"></div></td>
    <td className="p-4">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-muted"></div>
        <div>
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="h-3 bg-muted rounded w-32 mt-1"></div>
        </div>
      </div>
    </td>
    <td className="p-4 text-right"><div className="h-6 bg-muted rounded w-20 ml-auto"></div></td>
  </tr>
);

const LeaderboardRow = ({ entry }: { entry: LeaderboardEntry }) => {
  const shortAddress = `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;
  return (
    <tr className="border-b-4 border-primary hover:bg-accent/10 transition-colors duration-200">
      <td className="p-4 font-bold text-xl text-center w-16">{entry.rank}</td>
      <td className="p-4">
        <div className="flex items-center space-x-4">
          <img src={entry.pfpUrl} alt={entry.username} className="w-10 h-10 rounded-full object-cover border-4 border-primary" />
          <div>
            <div className="font-bold text-foreground uppercase">
              {entry.username || entry.display_name}
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {entry.fid > 0 ? `FID: ${entry.fid}` : shortAddress}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4 text-right font-bold text-lg text-destructive font-mono">
        -${entry.loss.toLocaleString()}
      </td>
    </tr>
  );
};

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
}

export default function Leaderboard({ data, isLoading }: LeaderboardProps) {
  return (
    <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
      <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground uppercase">WEEKLY LOSERBOARD</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-4 border-primary text-muted-foreground uppercase text-sm font-bold">
              <th className="p-4 text-center">RANK</th>
              <th className="p-4">TRADER</th>
              <th className="p-4 text-right">WEEKLY LOSS (USD)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            {!isLoading && data.map(entry => <LeaderboardRow key={entry.rank} entry={entry} />)}
          </tbody>
        </table>
        {!isLoading && data.length === 0 && (
            <div className="text-center p-8 text-muted-foreground uppercase">THE LEADERBOARD IS CURRENTLY EMPTY 😭</div>
        )}
      </div>
    </Card>
  );
}

