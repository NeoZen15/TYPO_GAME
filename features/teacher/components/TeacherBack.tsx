// The one way back, on every sub-page of the teacher space.
//
// Same control, same place, same behaviour on all four: a class, a student, an
// exercise, and the exercise composer. It is the first thing under the main bar,
// aligned on the panel column, so a teacher never has to look for it and never
// has to go back through the main navigation.
//
// The LABEL NAMES WHERE IT GOES, which is what lets one control carry a context:
// an exercise opened from a class goes back to that class by name, the same
// exercise opened from the Exercises tab goes back to the list.

export default function TeacherBack({
  label,
  onClick,
}: {
  /** The destination, named. "All classes", "DSAA 1 · Group B", "Exercises". */
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="st-backbar">
      <button type="button" className="st-back" onClick={onClick}>
        <span className="st-back__arrow" aria-hidden="true">
          ←
        </span>
        {label}
      </button>
    </div>
  );
}
