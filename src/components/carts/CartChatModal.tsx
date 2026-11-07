import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Send, Loader2, Users } from 'lucide-react';

interface CartChatModalProps {
  cartId: string | null;
  cartTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CartChatModal: React.FC<CartChatModalProps> = ({
  cartId,
  cartTitle = 'Group Cart Chat',
  isOpen,
  onClose,
}) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['cart_messages', cartId],
    enabled: Boolean(cartId) && isOpen,
    queryFn: async () => {
      if (!cartId) return [];
      const { data, error } = await supabase
        .from('cart_messages')
        .select(`
          id,
          cart_id,
          sender_id,
          message_text,
          created_at,
          sender:profiles!sender_id(full_name, username, avatar_url)
        `)
        .eq('cart_id', cartId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: isOpen ? 3000 : false, // Poll every 3s when chat is open
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user || !cartId || !messageText.trim()) return;

      // Ensure user is participant
      await supabase
        .from('cart_participants')
        .insert({ cart_id: cartId, user_id: user.id })
        .select()
        .maybeSingle();

      const { error } = await supabase.from('cart_messages').insert({
        cart_id: cartId,
        sender_id: user.id,
        message_text: messageText.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['cart_messages', cartId] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl max-h-[85vh] h-[550px] flex flex-col">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold truncate">{cartTitle}</DialogTitle>
              <DialogDescription className="text-[11px] flex items-center gap-1">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span>Private chat for joined neighbors</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs">
          {isLoading ? (
            <div className="py-12 flex justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">No messages yet</p>
              <p className="text-[11px]">
                Say hello, ask neighbors if they need anything added, or coordinate the gate meetup!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = user?.id === msg.sender_id;
              const sender =
                msg.sender && typeof msg.sender === 'object'
                  ? (msg.sender as { username?: string; avatar_url?: string })
                  : {};
              const senderHandle = sender.username ? `@${sender.username.replace(/^@/, '')}` : '@resident';
              const myHandle = profile?.username ? `@${profile.username.replace(/^@/, '')}` : '@you';
              const displayHandle = isMine ? myHandle : senderHandle;

              const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isMine && (
                    <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                      <AvatarImage src={sender.avatar_url} />
                      <AvatarFallback className="text-[9px] bg-muted font-mono font-bold">
                        {sender.username ? sender.username.slice(0, 2).toUpperCase() : '@'}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className={`space-y-0.5 max-w-[80%] ${isMine ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                      <span className="font-semibold text-foreground/80 font-mono">
                        {displayHandle}
                      </span>
                      <span>•</span>
                      <span>{timeStr}</span>
                    </div>

                    <div
                      className={`p-2.5 rounded-2xl leading-relaxed text-xs break-words ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted/80 text-foreground rounded-tl-sm border border-border/60'
                      }`}
                    >
                      {msg.message_text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSend} className="pt-2 border-t border-border/60 flex items-center gap-2">
          <Input
            placeholder="Type a message to the group..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={sendMutation.isPending}
            className="h-10 text-xs flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sendMutation.isPending || !messageText.trim()}
            className="h-10 px-3 font-semibold gap-1 shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
