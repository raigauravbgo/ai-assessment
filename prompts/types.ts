// Shared input shapes for the five scoring prompts.
// PRD §11: prompts are parameterised by problem config + submission artifacts,
// not hardcoded to any one problem.

export type ProblemConfig = {
  id: string;
  role: string;
  title: string;
  description: string;
  zoneCriteria: {
    floor: string;
    middle: string;
    stretch: string;
  };
  trapDefinitions: Array<{
    name: string;
    caughtLooksLike: string;
    missedLooksLike: string;
  }>;
  ambiguousRequirement: string;
  messyDataSpec: string;
  hiddenConstraint: string;
};

export type SubmissionArtifacts = {
  fileTree: string;
  sourceFiles: Array<{ path: string; content: string }>;
  notes: string | null;
  diagnosticResponses: Array<{
    questionIndex: number;
    questionText: string;
    responseText: string;
  }>;
};
