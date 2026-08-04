import {
  collection,
  limit,
  onSnapshot,
  query,
  type Timestamp,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';

import {
  firebaseAuth,
  firebaseFunctions,
  firebaseStorage,
  firestoreDb,
} from '@/lib/firebase';
import { APP_ID, publicCollectionPath } from '@/lib/firebase-paths';

export type ForumReply = {
  id: string;
  threadId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  authorPlate?: string;
  authorModel?: string;
  likeCount: number;
  likedByViewer?: boolean;
  createdAt?: Timestamp;
  status?: string;
};

export type ForumPollOption = {
  id: string;
  text: string;
  voteCount: number;
};

export type ForumPoll = {
  options: ForumPollOption[];
  totalVotes: number;
  durationHours: 24 | 72 | 168;
  expiresAtMs: number;
};

export type ForumMention = {
  userId: string;
  fullName: string;
  model?: string;
};

export type ForumEventReference = {
  eventId: string;
  name: string;
  eventMode: 'meetup' | 'convoy';
  scheduledStartAtMs?: number;
};

type ForumLike = {
  id: string;
  threadId: string;
  replyId?: string | null;
  targetType?: 'thread' | 'reply';
  userId: string;
};

type ForumPollVote = {
  id: string;
  threadId: string;
  userId: string;
  optionId: string;
};

export type ForumThread = {
  id: string;
  category: 'places' | 'builds' | 'technical' | 'roadlife';
  body: string;
  imageUrl?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  } | null;
  poll?: ForumPoll | null;
  mentions?: ForumMention[];
  eventReference?: ForumEventReference | null;
  viewerPollOptionId?: string;
  authorUserId: string;
  authorName: string;
  authorPlate?: string;
  authorModel: string;
  likeCount: number;
  replyCount: number;
  pinnedReplyId?: string | null;
  likedByViewer?: boolean;
  replies: ForumReply[];
  createdAt?: Timestamp;
  status?: string;
};

export function useForumFeed() {
  const [rawThreads, setRawThreads] = useState<Omit<ForumThread, 'replies'>[]>([]);
  const [rawReplies, setRawReplies] = useState<ForumReply[]>([]);
  const [rawLikes, setRawLikes] = useState<ForumLike[]>([]);
  const [rawPollVotes, setRawPollVotes] = useState<ForumPollVote[]>([]);
  const [loadingState, setLoadingState] = useState({
    threads: true,
    replies: true,
    likes: true,
    votes: Boolean(firebaseAuth.currentUser?.uid),
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const feedQuery = query(
      collection(firestoreDb, publicCollectionPath('forumThreads')),
      limit(50),
    );

    const stopThreads = onSnapshot(feedQuery, (snapshot) => {
      const nextThreads = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }) as Omit<ForumThread, 'replies'>)
        .filter((thread) => (
          thread.body &&
          thread.authorName &&
          thread.status !== 'deleted' &&
          thread.status !== 'hidden'
        ))
        .sort((left, right) => (
          (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0)
        ));
      setRawThreads(nextThreads);
      setError('');
      setLoadingState((current) => ({ ...current, threads: false }));
    }, (snapshotError) => {
      setError(snapshotError.message);
      setLoadingState((current) => ({ ...current, threads: false }));
    });

    const stopReplies = onSnapshot(
      query(collection(firestoreDb, publicCollectionPath('forumReplies')), limit(300)),
      (snapshot) => {
        setRawReplies(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as ForumReply));
        setLoadingState((current) => ({ ...current, replies: false }));
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoadingState((current) => ({ ...current, replies: false }));
      },
    );

    const stopLikes = onSnapshot(
      query(collection(firestoreDb, publicCollectionPath('forumLikes')), limit(600)),
      (snapshot) => {
        setRawLikes(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as ForumLike));
        setLoadingState((current) => ({ ...current, likes: false }));
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoadingState((current) => ({ ...current, likes: false }));
      },
    );

    const viewerId = firebaseAuth.currentUser?.uid;
    const stopVotes = viewerId ? onSnapshot(
      query(
        collection(firestoreDb, publicCollectionPath('forumPollVotes')),
        where('userId', '==', viewerId),
        limit(100),
      ),
      (snapshot) => {
        setRawPollVotes(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as ForumPollVote));
        setLoadingState((current) => ({ ...current, votes: false }));
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoadingState((current) => ({ ...current, votes: false }));
      },
    ) : () => {};

    return () => {
      stopThreads();
      stopReplies();
      stopLikes();
      stopVotes();
    };
  }, []);

  const threads = useMemo(() => {
    const viewerId = firebaseAuth.currentUser?.uid;
    const viewerThreadLikes = new Set(rawLikes
      .filter((like) => like.userId === viewerId && like.targetType !== 'reply' && !like.replyId)
      .map((like) => like.threadId));
    const viewerReplyLikes = new Set(rawLikes
      .filter((like) => like.userId === viewerId && (like.targetType === 'reply' || Boolean(like.replyId)))
      .map((like) => like.replyId)
      .filter(Boolean));
    const viewerPollVotes = new Map(rawPollVotes
      .filter((vote) => vote.userId === viewerId)
      .map((vote) => [vote.threadId, vote.optionId]));

    return rawThreads.map((thread) => {
      const replies = rawReplies
        .filter((reply) => reply.threadId === thread.id && reply.status !== 'deleted' && reply.status !== 'hidden')
        .map((reply) => ({ ...reply, likedByViewer: viewerReplyLikes.has(reply.id) }))
        .sort((left, right) => {
          if (left.id === thread.pinnedReplyId) return -1;
          if (right.id === thread.pinnedReplyId) return 1;
          return (left.createdAt?.toMillis?.() ?? 0) - (right.createdAt?.toMillis?.() ?? 0);
        });
      return {
        ...thread,
        likedByViewer: viewerThreadLikes.has(thread.id),
        viewerPollOptionId: viewerPollVotes.get(thread.id),
        replies,
      } as ForumThread;
    });
  }, [rawLikes, rawPollVotes, rawReplies, rawThreads]);

  return {
    threads,
    loading: loadingState.threads || loadingState.replies || loadingState.likes || loadingState.votes,
    error,
  };
}

export async function toggleForumLike(threadId: string, replyId?: string) {
  const result = await httpsCallable(firebaseFunctions, 'toggleForumLike')({
    threadId,
    replyId: replyId ?? '',
  });
  return result.data;
}

export async function addForumReply(threadId: string, body: string) {
  const result = await httpsCallable(firebaseFunctions, 'addForumReply')({
    threadId,
    body: body.trim(),
  });
  return result.data;
}

export async function pinForumSolution(threadId: string, replyId: string) {
  const result = await httpsCallable(firebaseFunctions, 'pinForumSolution')({ threadId, replyId });
  return result.data;
}

export async function createForumThread(
  category: ForumThread['category'],
  body: string,
  extras: {
    image?: {
    uri: string;
    fileName?: string | null;
    fileSize?: number;
    mimeType?: string | null;
    } | null;
    location?: ForumThread['location'];
    poll?: { options: string[]; durationHours: 24 | 72 | 168 } | null;
    mentionUserIds?: string[];
    eventId?: string;
  } = {},
) {
  let uploadedImage = { imageUrl: '', storagePath: '' };
  try {
    uploadedImage = await uploadForumImage(extras.image);
    const result = await httpsCallable(firebaseFunctions, 'createForumThread')({
      thread: {
        category,
        body: body.trim(),
        location: extras.location ?? null,
        poll: extras.poll ?? null,
        mentionUserIds: extras.mentionUserIds ?? [],
        eventId: extras.eventId ?? '',
        ...uploadedImage,
      },
    });
    return result.data;
  } catch (error) {
    if (uploadedImage.storagePath) {
      await deleteObject(ref(firebaseStorage, uploadedImage.storagePath)).catch(() => {});
    }
    throw error;
  }
}

export async function voteForumPoll(threadId: string, optionId: string) {
  const result = await httpsCallable(firebaseFunctions, 'voteForumPoll')({ threadId, optionId });
  return result.data;
}

async function uploadForumImage(image?: {
  uri: string;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
} | null) {
  if (!image) return { imageUrl: '', storagePath: '' };
  if (Number(image.fileSize ?? 0) > 10 * 1024 * 1024) {
    throw new Error('Görsel en fazla 10 MB olabilir.');
  }

  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Görsel yüklemek için yeniden giriş yapmalısın.');

  const response = await fetch(image.uri);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('Yalnızca görsel dosyası seçebilirsin.');
  }
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('Görsel en fazla 10 MB olabilir.');
  }

  const safeName = String(image.fileName || `forum-${Date.now()}.jpg`)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .slice(-100);
  const storagePath = `artifacts/${APP_ID}/forumThreads/${userId}/${Date.now()}-${safeName}`;
  const storageRef = ref(firebaseStorage, storagePath);
  await uploadBytes(storageRef, blob, {
    cacheControl: 'public,max-age=86400',
    contentType: image.mimeType || blob.type || 'image/jpeg',
  });
  return {
    imageUrl: await getDownloadURL(storageRef),
    storagePath,
  };
}
