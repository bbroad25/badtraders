interface LoaderProps {
  text?: string;
}

export default function Loader({ text = "Loading..." }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 text-center p-4">
      <div className="w-12 h-12 border-4 border-t-transparent border-green-400 rounded-full animate-spin"></div>
      <p className="text-gray-400">{text}</p>
    </div>
  );
}

