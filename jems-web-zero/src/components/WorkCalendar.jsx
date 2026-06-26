import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate } from 'react-router-dom';
import { dispatchWorkService } from '../services/dispatch';

export default function WorkCalendar({ selfOnly = true }) {
  const navigate = useNavigate();

  const fetchEvents = async (fetchInfo, successCallback, failureCallback) => {
    try {
      const res = await dispatchWorkService.calendar({
        start: fetchInfo.startStr,
        end: fetchInfo.endStr,
        self_only: selfOnly,
      });
      successCallback(res.data);
    } catch {
      failureCallback(new Error('Failed to load calendar events'));
    }
  };

  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent.preventDefault();
    navigate(`/dispatch/work/${clickInfo.event.id}`);
  };

  const handleEventDrop = async (dropInfo) => {
    try {
      await dispatchWorkService.move(dropInfo.event.id, dropInfo.event.startStr);
    } catch {
      dropInfo.revert();
    }
  };

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      }}
      events={fetchEvents}
      editable={true}
      eventClick={handleEventClick}
      eventDrop={handleEventDrop}
    />
  );
}
