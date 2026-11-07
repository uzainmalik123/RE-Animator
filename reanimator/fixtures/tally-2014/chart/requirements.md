# Requirements Document

## Introduction

The chart of `tally-2014`, one of the graves of the graveyard (R6): what a hit counter should do, written by hand for Death to test the revived app against (D-R8). The app is not changed to fit it, and it has no planted bugs.

## Requirements

### Requirement 1: Counting

**User Story:** As a visitor, I want to count myself in, so that the tally goes up.

#### Acceptance Criteria

1. WHEN a visitor presses Count me in, THE Tally SHALL show a count one higher than before.
2. WHEN a visitor presses Count me in twice quickly, THE Tally SHALL count the visitor once.
3. THE Tally SHALL let a visitor count themselves in using only the keyboard.

### Requirement 2: Showing the count

**User Story:** As a visitor, I want to see how many have counted in, so that I know I'm not alone.

#### Acceptance Criteria

1. WHEN a visitor opens the page, THE Tally SHALL show the current count.
2. THE Tally SHALL keep the button usable on a small, slow phone.
