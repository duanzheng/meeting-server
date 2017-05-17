import Koa from 'koa';
import mongo from 'koa-mongo';
import _ from 'koa-route';
import moment from 'moment';

const app = new Koa();

const test = async (ctx) => {
    const result = await ctx.mongo.db('test1').collection('test').find({total: 123}).toArray();
    // ctx.body = {aaa: 123};
    ctx.body = result;
};

const getIndexData = async (ctx) => {
    const dateList = getNextWeekDate();

};

const getRoomList = async (ctx, date) => {
    const result = await ctx.mongo.db('meeting').collection('room').find().toArray();
    for (const room of result) {
        const roomRecord = await getRoomRecord({
            ctx,
            userId: 'Tony段',
            roomId: room.roomId,
            date
        });
        room.record = roomRecord;
    }
    ctx.body = result;
};

const getRoomRecord = async ({ ctx, userId, roomId, date }) => {
    const result = await ctx.mongo.db('meeting').collection('record').find({
        userId,
        roomId: roomId.toString(),
        date
    }).toArray();
    return result;
};

const getRoomDetail = async (ctx) => {
    const roomId = ctx.query.roomId;
    const date = ctx.query.date;
    const dateArray = date.split('-');
    const databaseDate = dateArray[1] + '-' + dateArray[2];

    const roomMsgList = await ctx.mongo.db('meeting').collection('room').find({
        roomId
    }).toArray();
    const roomRecord = await ctx.mongo.db('meeting').collection('record').find({
        roomId,
        date: databaseDate
    }).toArray();

    if (roomMsgList.length > 0) {
        const roomMsg = roomMsgList[0];
        ctx.body = {
            name: roomMsg.name,
            fill: roomMsg.fill,
            equip: roomMsg.equip,
            record: roomRecord
        }
    } else {
        ctx.body = {
            error: 1
        }
    }
};

const addRecord = async (ctx) => {
    let { roomId, date, theme, userId, timeList } = ctx.query;
    const databaseDate = date.split('-')[1] + '-' + date.split('-')[2];
    timeList = JSON.parse(timeList);
    let result;
    for (const timeItem of timeList) {
        result = await ctx.mongo.db('meeting').collection('record').insert({
            recordId: new Date().getTime(),
            roomId,
            date: databaseDate,
            theme,
            userId,
            startTime: timeItem.startTime,
            endTime: timeItem.endTime
        });
    }
    if (result) {
        ctx.body = {
            success: 1
        }
    } else {
        ctx.body = {
            success: 0,
            error: result
        }
    }
}

const getRecordByUser = async (ctx) => {
    const userId = ctx.query.userId;
    const result = await ctx.mongo.db('meeting').collection('record').find({
        userId
    }).sort({
        "_id": -1
    }).toArray();
    for (const item of result) {
        const roomMsg = await ctx.mongo.db('meeting').collection('room').find({
            roomId: item.roomId
        }).toArray();
        item.roomName = roomMsg[0].name;
    }
    ctx.body = result;
}

const search = async (ctx) => {
    let { date, duration, startTime, endTime } = ctx.query;
    let startHour = parseInt(startTime.split(':')[0]);
    let endHour = parseInt(endTime.split(':')[0]);
    const accessRoomIds = [];
    duration = parseInt(duration);

    if (endHour - startHour < duration) {
        duration = endHour - startHour;
    }

    let roomList = await ctx.mongo.db('meeting').collection('room').find().toArray();
    for (const room of roomList) {
        const recordsByDay = await ctx.mongo.db('meeting').collection('record').find({
            date: date,
            roomId: room.roomId
        }).toArray();
        if (judgetIntersect(recordsByDay, startHour, endHour, duration)) {
            accessRoomIds.push(room.roomId);
        }
    }
    await getRoomMsgByIds(ctx, date, accessRoomIds);
};

const getRoomMsgByIds = async (ctx, date, roomIdList) => {
    const roomIdObjList = [];
    for (const roomId of roomIdList) {
        roomIdObjList.push({
            roomId
        })
    }
    const result = await ctx.mongo.db('meeting').collection('room').find({
        $or: roomIdObjList
    }).toArray();
    for (const room of result) {
        const roomRecord = await getRoomRecord({
            ctx,
            userId: 'Tony段',
            roomId: room.roomId,
            date
        });
        room.record = roomRecord;
    }
    ctx.body = result;
}

const judgetIntersect = (recordList, startHour, endHour, duration) => {
    // console.log(recordList, startHour, endHour, duration);
    while (startHour <= endHour) {
        // if (startHour + duration > endHour) {
        //     startHour = endHour - duration;
        // }
        if (isSectionAvaliable(startHour, recordList, duration)) {
            return true;
        }
        startHour += parseInt(duration);
    }
    return false;
}

//返回true说明该时间段可行，返回false说明该时间段被占用
const isSectionAvaliable = (startHour, recordList, duration) => {
    let ret = true;
    for (const record of recordList) {
        if (!isNoIntersect(record, startHour, duration)) {
            ret = false;
        }
    }
    return ret;
}

//判断不相交
const isNoIntersect = (record,  targetStartTime, duration) => {
    const { startTime, endTime } = record;
    const workedStartTime = parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60;
    const workedEndTime = parseInt(endTime.split(':')[0]) + parseInt(endTime.split(':')[1]) / 60;
    let ret = false;

    if (workedStartTime >= targetStartTime + duration || workedEndTime <= targetStartTime) {
        ret = true;
    }
    return ret;
}

const cancel = async (ctx) => {
    const recordId = ctx.query.id;
    const result = await ctx.mongo.db('meeting').collection('record').remove({
        recordId: parseInt(recordId)
    });
    console.log(recordId);
    if (result.result.ok) {
        ctx.body = {
            success: 1
        }
    } else {
        ctx.body = {
            success: 0,
            error: result
        }
    }
};

const getNextWeekDate = (ctx) => {
    const days = [];
    for (var i = 0; i < 7; i++) {
        days.push(moment().add(i, 'd').format('YYYY-MM-DD'));
    }

    ctx.body = days;
};

app.use(mongo({
    host: '127.0.0.1',
    port: 27017,
    log: false
}));

app.use(_.get('/test', test));
app.use(_.get('/getIndexData', getIndexData));
app.use(_.get('/roomList/:date', getRoomList));
app.use(_.get('/roomDetail', getRoomDetail));
app.use(_.get('/addRecord', addRecord));
app.use(_.get('/getRecordByUser', getRecordByUser));
app.use(_.get('/search', search));
app.use(_.get('/cancel', cancel));
app.use(_.get('/getNextWeekDate', getNextWeekDate));

// response
// app.use(async (ctx) => {
//   ctx.body = 'Hello World'
// });

app.listen(3000, () => console.log('server started 3000'));

export default app

