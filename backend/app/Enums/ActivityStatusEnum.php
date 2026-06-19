<?php

namespace App\Enums;

enum ActivityStatusEnum: string
{
    case IN_PROGRESS = 'in_progress';
    case ON_HOLD = 'on_hold';
    case DONE = 'done';
}
