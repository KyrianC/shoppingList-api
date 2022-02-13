import * as express from 'express'
import * as http from 'http'
import * as cors from 'cors'
import { Schema, model, connect } from 'mongoose'
import { Server } from 'socket.io'

const app = express()
app.use(cors())
const server = http.createServer(app)
const io = new Server(server)

interface User {
    name: string;
    isConnected: boolean;
}

interface ListItem {
    name: string;
    priority: 1 | 2 | 3;
    quantity: number;
    done: boolean;
    created: Date;
    updated: Date;
}

interface Room {
    items: ListItem[]
    users: User[]
}

const userSchema = new Schema<User>({
    name: { type: String, required: true },
    isConnected: { type: Boolean, default: false }
})


const listItemSchema = new Schema<ListItem>({
    name: { type: String, required: true },
    priority: { type: Number, required: true, default: 1, min: 1, max: 3 },
    quantity: { type: Number, default: 1 },
    done: { type: Boolean, default: false },
    created: { type: Date, default: new Date(Date.now()) },
    updated: Date
});

const roomSchema = new Schema<Room>({
    items: [listItemSchema],
    users: [userSchema],
})

const UserModel = model<User>('User', userSchema);
const ListItemModel = model<ListItem>('ListItem', listItemSchema);
const RoomModel = model<Room>('Room', roomSchema);


io.on('connection', async (socket) => {
    console.log('A user connected')
    const { roomId, username } = socket.handshake.query as { roomId: string, username: string }
    const room = await RoomModel.findById(roomId)
    let user = room.users.find(u => u.name == username)
    // Join room
    try {
        if (room) {
            if (!user) {
                console.log('creating user')
                user = new UserModel({ name: username })
                room.users.push(user)
                room.save()
            }
            console.log(`Joining room ${room._id} as ${user.name}`)
            user.isConnected = true
            await room.save()
            socket.join(roomId)
            io.to(roomId).emit("joinRoom", room)
        }
    } catch (e) {
        console.error(e)
    }


    socket.on('addItem', async (item: ListItem) => {
        try {
            const addedItem = new ListItemModel(item)
            room.items.push(addedItem)
            room.save()
            io.to(roomId).emit('addItem', room.items)
        } catch (e) { console.error(e) }
    })


    socket.on('toggleItem', async (itemId: string) => {
        console.log('toggle done')
        try {
            const item = room.items.find(i => i._id == itemId)
            item.done = !item.done
            item.updated = new Date(Date.now())
            room.save()
            io.to(roomId).emit('toggleItem', room.items)
        } catch (e) { console.log(e) }
    })

    socket.on('deleteItem', async (itemId: string) => {
        console.log('deleting item with id ', itemId)
        // room.items.id(_id).remove();
        // room.save()
        // io.to(roomId).emit('deleteItem', room.items)
    })

    socket.on('disconnect', async () => {
        user.isConnected = false
        await room.save()
        console.log('user disconnected')
    })
})

async function main() {
    await connect(process.env.MONGODB_URL);
    server.listen(8000, '0.0.0.0')
}

main()
