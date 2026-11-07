# Requirements Document

## Introduction

The chart of `sundial-2015`, one of the graves of the graveyard (R6): what a clock page should do, written by hand for Death to test the revived app against (D-R8). The app is not changed to fit it, and it has no planted bugs.

## Requirements

### Requirement 1: Telling the time

**User Story:** As a visitor, I want to see the current time, so that I know what time it is.

#### Acceptance Criteria

1. WHEN a visitor opens the page, THE Sundial SHALL show the current time in UTC.
2. WHEN a visitor looks again, THE Sundial SHALL show a time no earlier than the one before.
3. THE Sundial SHALL show when it was built.

### Requirement 2: Strange paths

**User Story:** As a visitor, I want a clear answer when I ask for something that isn't there, so that I'm not left guessing.

#### Acceptance Criteria

1. WHEN a visitor asks for a path that does not exist, THE Sundial SHALL answer that nothing is there, with a 404.
2. THE Sundial SHALL stay readable on a small, slow phone.
