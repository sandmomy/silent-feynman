# VoiceBook Content Track

## Current published state

| Chapter | Canonical book id | PDF | Slides | Published audio | Notes |
| --- | --- | --- | --- | --- | --- |
| Ch1 - Everything Is Frequency | `book_1d7c4e2a11` | yes | yes | yes | Current soft launch chapter |
| Ch2 - Practical Frequency | `book_86f677ade3` | yes | yes | no | Needs published audio |
| Ch3 - Life Frequency | `book_d6ea5620bc` | yes | no | no | Needs slides + audio |
| Ch4 - Manifestation | `book_f79645dd19` | yes | no | no | Needs slides + audio |
| Ch5 - The Formula of Manifestation | `book_d552e8ca16` | yes | no | no | Needs slides + audio |
| Ch6 - Frequency Planner | `book_41468b32ad` | yes | no | no | Needs slides + audio |
| Ch7 - Life in Frequency | `book_fbbe1ffa94` | yes | no | no | Needs slides + audio |
| Ch8 - What Frequency Vibes Can Do for You | `book_71df792368` | yes | no | no | Needs slides + audio |

### Source folders

- Ch1: `library_data/books/book_1d7c4e2a11/source`
- Ch2: `library_data/books/book_86f677ade3/source`
- Ch3: `library_data/books/book_d6ea5620bc/source`
- Ch4: `library_data/books/book_f79645dd19/source`
- Ch5: `library_data/books/book_d552e8ca16/source`
- Ch6: `library_data/books/book_41468b32ad/source`
- Ch7: `library_data/books/book_fbbe1ffa94/source`
- Ch8: `library_data/books/book_71df792368/source`

### Notes on current data

- There is an older duplicate `book_chapter_1` folder at `library_data/books/book_361a6e3f1c`, but the live published chapter is `book_1d7c4e2a11`.
- Ch2 already has a solid public profile and `slides.pdf`; it is the closest chapter to finishing after Ch1.

## Parallel workstreams

### Stream A - Visual polish

- Refine home, login, shelf, and chapter detail pages
- Improve chapter presentation and chapter-to-chapter narrative
- Prepare the reader and shelf for a more premium mobile feel

### Stream B - NotebookLM / slides production

- Recreate `slides.pdf` for Ch3-Ch8
- Review visual consistency so the reader does not jump in style between chapters
- Keep Ch1-Ch2 as the benchmark for the desired format

### Stream C - Audio production

- Publish chapter audio for Ch2
- Produce and publish chapter audio for Ch3-Ch8
- Reuse existing render artifacts from `library_data/jobs` where viable before regenerating

#### Existing reusable artifact already found

- `library_data/jobs/job_016c5514a6f8`
  - contains a full `mock_preview` render
  - exports chapter-separated MP3 files
  - useful as structural reference and fallback while final audio is being produced

### Reusable audio mapping from `job_016c5514a6f8`

This mapping is an inference from the exported filenames and is good enough as a production guide:

- Ch1 -> `chapter_001_...mp3`
- Ch2 -> `chapter_002_...mp3`
- Ch3 -> `chapter_003_...mp3`
- Ch4 -> `chapter_004_...mp3`
- Ch5 -> `chapter_005_...mp3`
- Ch6 -> `chapter_006_...mp3`
- Ch7 -> `chapter_007_...mp3` + `chapter_008_...mp3`
- Ch8 -> `chapter_009_...mp3` + `chapter_010_...mp3` + `chapter_011_...mp3`

### Production order recommendation

1. Publish final audio for Ch2
2. Create `slides.pdf` for Ch3-Ch6
3. Create `slides.pdf` for Ch7-Ch8
4. Publish audio for Ch3-Ch6
5. Resolve the split-audio structure for Ch7-Ch8 and publish those last

## What is not blocking progress right now

- No additional purchase work
- No `.com` integration yet
- No native mobile app yet

## What may be needed later from the client

- Final approved covers or permission to generate them
- Final commercial copy
- Final approved audio takes when multiple versions exist
