<?php

namespace App\Enums;

enum CallStatus: string
{
    case Ringing = 'ringing';
    case Ongoing = 'ongoing';
    case Declined = 'declined';
    case Missed = 'missed';
    case Cancelled = 'cancelled';
    case Ended = 'ended';
    case Failed = 'failed';

    public function isActive(): bool
    {
        return in_array($this, [self::Ringing, self::Ongoing], true);
    }
}
