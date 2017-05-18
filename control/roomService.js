/**
 * Created by mac on 2017/5/17.
 */
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
    return result;
};

const getRoomRecord = async ({ ctx, userId, roomId, date }) => {
    const result = await ctx.mongo.db('meeting').collection('record').find({
        userId,
        roomId: roomId.toString(),
        date
    }).toArray();
    return result;
};

export default {
    getRoomList
}
