import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { repository } from "@/lib/persistence";
import { ChatService } from "@/lib/chat/chat-service";

const ChatRequestSchema = z.object({
  datasetVersionId: z.string().optional(),
  message: z.string().min(1, "Poruka ne sme biti prazna"),
  conversation: z
    .array(
      z.object({
        id: z.string(),
        datasetVersionId: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        citations: z.array(z.any()).default([]),
        createdAt: z.string(),
      })
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const chatService = new ChatService(repository);
    const response = await chatService.handleChat({
      datasetId: params.datasetId,
      datasetVersionId: parsed.data.datasetVersionId,
      message: parsed.data.message,
      conversation: parsed.data.conversation,
    });

    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Chat API error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get("versionId");

    let version = versionId
      ? await repository.getVersion(versionId)
      : await repository.getLatestVersion(params.datasetId);

    if (!version) {
      return NextResponse.json([]);
    }

    const messages = await repository.listChatMessages(version.id);
    return NextResponse.json(messages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
