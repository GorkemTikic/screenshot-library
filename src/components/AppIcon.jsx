import React from 'react';
import {
    Activity, Archive, BarChart3, Bot, CandlestickChart, Check, ChevronDown,
    ClipboardList, CopyCheck, FileImage, HandCoins, Heart, ImagePlus, LayoutGrid,
    LockKeyhole, Menu, MessageSquarePlus, Moon, PanelTop, Scale, Search, Settings2,
    ShieldCheck, Smartphone, Sparkles, Sun, TicketCheck, UserRound, UsersRound, X,
} from 'lucide-react';

const ICONS = {
    Activity, Archive, BarChart3, Bot, CandlestickChart, Check, ChevronDown,
    ClipboardList, CopyCheck, FileImage, HandCoins, Heart, ImagePlus, LayoutGrid,
    LockKeyhole, Menu, MessageSquarePlus, Moon, PanelTop, Scale, Search, Settings2,
    ShieldCheck, Smartphone, Sparkles, Sun, TicketCheck, UserRound, UsersRound, X,
};

export function AppIcon({ name, size = 18, strokeWidth = 1.8, ...props }) {
    const Icon = ICONS[name] || LayoutGrid;
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
