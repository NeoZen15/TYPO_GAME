import TrainingIntro from "@/features/modes/components/TrainingIntro";

// Was a bare redirect to /game, so the player landed on the first question
// without reading a line about the mode. Vision §2.1 requires the philosophy of
// Training to be stated at its entrance.
export default function PlayTrainingPage() {
  return <TrainingIntro />;
}
