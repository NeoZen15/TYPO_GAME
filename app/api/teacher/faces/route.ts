import { NextResponse } from "next/server";

import {
  confusablePairs,
  faceTree,
  facesBySlugs,
  facesOfScope,
  playableCount,
  searchFaces,
} from "@/lib/teacher/faces-catalog";
import type { FaceScope } from "@/lib/teacher/faces-contracts";

// The composer's window onto the real catalogue.
//
// WHY A ROUTE RATHER THAN PROPS. The catalogue is 3.4 MB and the runtime asset
// manifest another 0.8 MB; both are server only by contract. A picker over 1 279
// faces cannot ship that to the browser, and it does not need to: it needs a
// small tree with counts on arrival, then a handful of rows per search. Each row
// carries its own CSS family and, for a self hosted face, the descriptor the
// client injects before painting the specimen. Adobe faces carry null, their
// family being already declared by the stylesheet in the root layout.
//
// READ ONLY, AND NOTHING PERSONAL. This endpoint answers about fonts. It never
// touches a student, a class, a session or `user_typeface_state`, so it stays
// outside the teacher read gate rather than needing an exception in it.
//
// Four shapes, one route:
//   GET /api/teacher/faces                     the family tree, with counts
//   GET /api/teacher/faces?q=univ              name search
//   GET /api/teacher/faces?scope=serif|didone  a sample of one branch
//   GET /api/teacher/faces?slugs=a,b,c         rows for an existing selection

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const slugs = url.searchParams.get("slugs");
  const scope = url.searchParams.get("scope");

  if (slugs) {
    const wanted = slugs
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 60);
    const faces = facesBySlugs(wanted);
    return NextResponse.json({ faces, pairs: confusablePairs(wanted) });
  }

  if (query) {
    return NextResponse.json({ faces: searchFaces(query) });
  }

  if (scope) {
    // "category|key", so one parameter carries both halves of a scope.
    const [kind, key] = scope.split("|");
    if ((kind !== "category" && kind !== "subcategory") || !key) {
      return NextResponse.json({ error: "bad scope" }, { status: 400 });
    }
    const asScope: FaceScope = { kind, key, label: key, count: 0 };
    return NextResponse.json({ faces: facesOfScope(asScope) });
  }

  return NextResponse.json({ tree: faceTree(), total: playableCount() });
}
