import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const feedbackSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  comment: z.string().trim().min(5, 'Comment must be at least 5 characters').max(500),
  rating: z.number().int().min(1).max(5).default(5),
});

export async function GET() {
  try {
    const feedbacks = await prisma.landingFeedback.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        comment: true,
        rating: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('Failed to fetch landing feedback:', error);
    return NextResponse.json({ feedbacks: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await getCurrentUser().catch(() => null);

    const feedback = await prisma.landingFeedback.create({
      data: {
        name: parsed.data.name,
        comment: parsed.data.comment,
        rating: parsed.data.rating,
        status: 'APPROVED',
        userId: user?.id ?? null,
      },
      select: {
        id: true,
        name: true,
        comment: true,
        rating: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, feedback }, { status: 201 });
  } catch (error) {
    console.error('Failed to submit landing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
