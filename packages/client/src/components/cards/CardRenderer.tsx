import type { CardData } from "@studentassist/shared";
import CalendarCard from "./CalendarCard";
import TaskCard from "./TaskCard";
import GitHubCard from "./GitHubCard";
import NewsCard from "./NewsCard";
import WeatherCard from "./WeatherCard";

interface CardRendererProps {
  cards: CardData[];
}

const CARD_MAP: Record<
  string,
  React.ComponentType<{ data: unknown }>
> = {
  calendar: CalendarCard,
  tasks: TaskCard,
  github: GitHubCard,
  news: NewsCard,
  weather: WeatherCard,
};

export default function CardRenderer({ cards }: CardRendererProps) {
  if (!cards.length) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      {cards.map((card, i) => {
        const Component = CARD_MAP[card.type];
        if (!Component) return null;
        return <Component key={`${card.type}-${i}`} data={card.data} />;
      })}
    </div>
  );
}
