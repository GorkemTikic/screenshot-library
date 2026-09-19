import React from 'react';
import {
    Activity, Archive, ArrowLeft, ArrowRight, BarChart3, Bot, CandlestickChart, Check, CheckCircle2,
    ChevronDown, CircleDot, CircleSlash2, ClipboardList, Clock3, Copy, CopyCheck, Crop, ExternalLink, Eye, FileImage,
    HandCoins, Heart, Highlighter, ImagePlus, Images, Languages, LayoutGrid, LockKeyhole, Menu, MessageSquarePlus,
    LoaderCircle, Monitor, Moon, MoveUpRight, PanelRightOpen, PanelTop, Pencil, Plus, Redo2, RefreshCw, RotateCcw, Save, Scale, ScanLine, Search, SearchX, Settings2, ShieldCheck,
    SlidersHorizontal, Smartphone, Sparkles, Sun, TicketCheck, Trash2, Undo2, UploadCloud, UserRound, UsersRound, X,
} from 'lucide-react';

const ICONS = {
    Activity, Archive, ArrowLeft, ArrowRight, BarChart3, Bot, CandlestickChart, Check, CheckCircle2,
    ChevronDown, CircleDot, CircleSlash2, ClipboardList, Clock3, Copy, CopyCheck, Crop, ExternalLink, Eye, FileImage,
    HandCoins, Heart, Highlighter, ImagePlus, Images, Languages, LayoutGrid, LockKeyhole, Menu, MessageSquarePlus,
    LoaderCircle, Monitor, Moon, MoveUpRight, PanelRightOpen, PanelTop, Pencil, Plus, Redo2, RefreshCw, RotateCcw, Save, Scale, ScanLine, Search, SearchX, Settings2, ShieldCheck,
    SlidersHorizontal, Smartphone, Sparkles, Sun, TicketCheck, Trash2, Undo2, UploadCloud, UserRound, UsersRound, X,
};

export function AppIcon({ name, size = 18, strokeWidth = 1.8, ...props }) {
    const Icon = ICONS[name] || LayoutGrid;
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
