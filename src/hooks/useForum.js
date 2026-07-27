import { useEffect, useState } from "react";
import {
  addFirebaseForumReply,
  createFirebaseForumThread,
  isFirebaseForumRepositoryEnabled,
  subscribeFirebaseForum,
  toggleFirebaseForumLike,
} from "../repositories/firebaseForumRepository";

const emptyForm = {
  category: "roadlife",
  body: "",
  location: null,
};

export function useForum(user, enabled = true) {
  const [threads, setThreads] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [pendingKey, setPendingKey] = useState("");

  useEffect(() => {
    if (!user || !enabled || !isFirebaseForumRepositoryEnabled()) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    subscribeFirebaseForum(
      user.firebaseUid ?? user.userId ?? user.id,
      (nextThreads) => !cancelled && setThreads(nextThreads),
      () => !cancelled && setFeedback("Forum akışı su anda yenilenemedi."),
    ).then((nextUnsubscribe) => {
      if (cancelled) nextUnsubscribe();
      else unsubscribe = nextUnsubscribe;
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled, user]);

  const createThread = async (imageFile = null) => {
    if (!form.body.trim()) {
      setFeedback("Zorunlu alanları doldurunuz.");
      return false;
    }
    setPendingKey("create");
    setFeedback("");
    try {
      await createFirebaseForumThread(form, imageFile);
      setForm(emptyForm);
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Paylaşım oluşturulamadı.");
      return false;
    } finally {
      setPendingKey("");
    }
  };

  const toggleLike = async (threadId) => {
    setPendingKey(`like:${threadId}`);
    try {
      await toggleFirebaseForumLike(threadId);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Beğeni kaydedilemedi.");
    } finally {
      setPendingKey("");
    }
  };

  const addReply = async (threadId, body) => {
    if (!body.trim()) return false;
    setPendingKey(`reply:${threadId}`);
    try {
      await addFirebaseForumReply(threadId, body);
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Yanıt gönderilemedi.");
      return false;
    } finally {
      setPendingKey("");
    }
  };

  return {
    addReply,
    createThread,
    feedback,
    form,
    pendingKey,
    setForm,
    threads,
    toggleLike,
  };
}
