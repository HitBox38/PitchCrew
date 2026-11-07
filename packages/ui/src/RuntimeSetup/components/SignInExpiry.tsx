export const SignInExpiry = ({ seconds }: { seconds: number }) => {
  return (
    <p className="quiet">
      {seconds
        ? `Time left: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
        : 'The attempt reached its time limit. Waiting for the CLI to stop; cancel to end it now.'}
    </p>
  );
};
