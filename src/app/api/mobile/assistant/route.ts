import { POST as assistantPost } from '@/app/api/assistant/route';

// Mobile assistant route - re-exports the main assistant POST handler
// to ensure complete synchronization and feature parity across web and mobile.
export const POST = assistantPost;
