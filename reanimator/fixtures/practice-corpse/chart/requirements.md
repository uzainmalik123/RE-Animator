# Requirements Document

## Introduction

The chart of `guestbook-2016`, our practice corpse (D-R14): what any guestbook should do, written by hand for Death to test the revived app against (D-R8). The app is not changed to fit it, and it has no planted bugs.

## Requirements

### Requirement 1: Signing the guestbook

**User Story:** As a visitor, I want to sign the guestbook, so that my message is left for others.

#### Acceptance Criteria

1. WHEN a visitor signs with a name and a message, THE Guestbook SHALL show that entry in the list.
2. WHEN a visitor clicks Sign twice quickly, THE Guestbook SHALL record only one entry.
3. IF a visitor signs with an empty name, THEN THE Guestbook SHALL refuse the entry and show why.

### Requirement 2: Reading the guestbook

**User Story:** As a visitor, I want to read what others wrote, so that I can see who came before me.

#### Acceptance Criteria

1. WHEN an entry contains any text, THE Guestbook SHALL show it exactly as written.
2. THE Guestbook SHALL let a visitor sign using only the keyboard.
3. THE Guestbook SHALL keep the form usable on a small, slow phone.
